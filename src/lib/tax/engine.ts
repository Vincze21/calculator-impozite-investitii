import type { NormalizedTransaction, NormalizedDividend, OtherIncome } from '@/types/transaction';
import type { BrokerConfig } from '@/types/broker';
import type { TaxResult, FiscalYear, CapitalGainResult, LossCarryForward, BrokerComparisonResult } from '@/types/tax';
import { calcCapitalGainsResident, calcCapitalGainsNonResident } from './capital-gains';
import { calcDividendTax, calcDividendsNetForCASS } from './dividends';
import { calcCASS, type CASSIncomeBreakdown } from './cass';
import { createLossCarryForward } from './loss-carry';
import { DEADLINES } from '@/lib/constants';
import { compareBrokerRegimes } from './broker-comparator';

export interface CalculatorInput {
  fiscalYear: FiscalYear;
  brokers: BrokerConfig[];
  transactionsByBroker: Record<string, NormalizedTransaction[]>;
  foreignDividends: NormalizedDividend[];
  domesticDividends: NormalizedDividend[];
  otherIncome: OtherIncome;
  carriedLosses: LossCarryForward[];
  exchangeRates: Map<string, number>; // "CURRENCY_YYYY-MM-DD" -> rate
  annualAvgRates: Record<string, number>; // "USD" -> avg rate
}

/**
 * Functia principala de calcul — orchestreaza toate sub-modulele.
 * ZERO dependinte de React. Functie pura.
 */
export function calculateTaxes(input: CalculatorInput): TaxResult {
  const {
    fiscalYear,
    brokers,
    transactionsByBroker,
    foreignDividends,
    domesticDividends,
    otherIncome,
    carriedLosses,
    exchangeRates,
    annualAvgRates,
  } = input;

  // 1. CAPITAL GAINS per broker
  const capitalGains: CapitalGainResult[] = [];
  const newCarriedLosses: LossCarryForward[] = [];
  let remainingCarriedLosses = [...carriedLosses];

  for (const broker of brokers) {
    const transactions = transactionsByBroker[broker.id] ?? [];
    if (transactions.length === 0) continue;

    if (broker.type === 'resident') {
      const result = calcCapitalGainsResident(
        transactions,
        fiscalYear,
        broker.id,
        exchangeRates
      );
      capitalGains.push(result);
    } else {
      const result = calcCapitalGainsNonResident(
        transactions,
        fiscalYear,
        broker.id,
        remainingCarriedLosses,
        exchangeRates
      );
      capitalGains.push(result);

      if (result.newCarriedLoss > 0) {
        newCarriedLosses.push(createLossCarryForward(result.newCarriedLoss, fiscalYear));
      }
    }
  }

  // 2. DIVIDEND TAX (foreign only — domestic is withheld at source)
  const dividendResult = calcDividendTax(foreignDividends, fiscalYear, annualAvgRates);

  // 3. CASS
  const allDividends = [...foreignDividends, ...domesticDividends];
  const dividendsNetForCASS = calcDividendsNetForCASS(allDividends, annualAvgRates);

  const cassBreakdown: CASSIncomeBreakdown = {
    capitalGainsResident: capitalGains
      .filter(cg => cg.brokerType === 'resident')
      .reduce((sum, cg) => sum + cg.totalGrossGain, 0), // brut per tranzactie profitabila
    capitalGainsNonResident: capitalGains
      .filter(cg => cg.brokerType === 'nonresident')
      .reduce((sum, cg) => sum + Math.max(0, cg.netGain), 0), // net anual
    dividendsNet: dividendsNetForCASS,
    interestNet: otherIncome.interestIncome,
    cryptoGains: otherIncome.cryptoGains,
    rentalIncome: otherIncome.rentalIncome,
    otherIncome: otherIncome.otherIncome,
    govBondExcluded: otherIncome.govBondIncome,
  };

  const cassResult = calcCASS(cassBreakdown, fiscalYear);

  // 4. TOTALS
  const totalCapitalGainsTax = capitalGains.reduce((sum, cg) => sum + cg.tax, 0);
  const totalDividendTax = dividendResult.totalTaxDue;
  const totalCASS = cassResult.amount;
  const totalDue = Math.round((totalCapitalGainsTax + totalDividendTax + totalCASS) * 100) / 100;

  // 5. D212 required?
  const d212Reasons: string[] = [];
  const hasNonResident = brokers.some(b => b.type === 'nonresident');
  const hasForeignDividends = foreignDividends.length > 0;
  const hasCrypto = otherIncome.cryptoGains > 0;
  const cassExceeded = cassResult.totalNonSalaryIncome >= 24300;

  if (hasNonResident) d212Reasons.push('Castiguri prin broker nerezident');
  if (hasForeignDividends) d212Reasons.push('Dividende din strainatate');
  if (hasCrypto) d212Reasons.push('Venituri din criptomonede');
  if (cassExceeded) d212Reasons.push('Venituri non-salariale cumulate >= 24.300 lei (CASS)');

  const deadlineKey = `venituri_${fiscalYear}`;
  const deadline = DEADLINES[deadlineKey] ?? { filing: '', payment: '' };

  // 6. BROKER COMPARISON (hypothetical: all transactions through one regime)
  const allTransactions = Object.values(transactionsByBroker).flat();
  let comparison: BrokerComparisonResult | null = null;
  if (allTransactions.some(t => t.type === 'sell')) {
    comparison = compareBrokerRegimes({
      fiscalYear,
      allTransactions,
      carriedLosses,
      otherIncome,
      dividendsNetForCASS,
      exchangeRates,
    });
  }

  return {
    fiscalYear,
    capitalGains,
    dividends: dividendResult,
    cass: cassResult,
    totalCapitalGainsTax: Math.round(totalCapitalGainsTax * 100) / 100,
    totalDividendTax: Math.round(totalDividendTax * 100) / 100,
    totalCASS,
    totalDue,
    d212Required: d212Reasons.length > 0,
    d212Reason: d212Reasons,
    deadline,
    newCarriedLosses,
    comparison,
  };
}
