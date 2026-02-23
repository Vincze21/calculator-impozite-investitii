import type { NormalizedTransaction, OtherIncome } from '@/types/transaction';
import type {
  FiscalYear,
  LossCarryForward,
  BrokerComparisonResult,
  BrokerComparisonSide,
  ComparisonInsight,
} from '@/types/tax';
import type { CASSIncomeBreakdown } from './cass';
import { calcCapitalGainsResident, calcCapitalGainsNonResident } from './capital-gains';
import { calcCASS } from './cass';
import { RATES_RESIDENT, RATES_NONRESIDENT } from '@/lib/constants';

export interface ComparatorInput {
  fiscalYear: FiscalYear;
  allTransactions: NormalizedTransaction[];
  carriedLosses: LossCarryForward[];
  otherIncome: OtherIncome;
  dividendsNetForCASS: number;
  exchangeRates: Map<string, number>;
}

/**
 * Compara regimul fiscal broker rezident vs nerezident pe aceleasi tranzactii.
 * Functie pura, zero dependinte de React.
 */
export function compareBrokerRegimes(input: ComparatorInput): BrokerComparisonResult {
  const {
    fiscalYear,
    allTransactions,
    carriedLosses,
    otherIncome,
    dividendsNetForCASS,
    exchangeRates,
  } = input;

  // 1. Run both regimes on the same transactions
  const residentResult = calcCapitalGainsResident(
    allTransactions,
    fiscalYear,
    '__cmp_ro',
    exchangeRates
  );

  const nonresidentResult = calcCapitalGainsNonResident(
    allTransactions,
    fiscalYear,
    '__cmp_intl',
    [...carriedLosses],
    exchangeRates
  );

  // 2. CASS for resident scenario (brut per tranzactie profitabila)
  const cassBreakdownResident: CASSIncomeBreakdown = {
    capitalGainsResident: residentResult.totalGrossGain,
    capitalGainsNonResident: 0,
    dividendsNet: dividendsNetForCASS,
    interestNet: otherIncome.interestIncome,
    cryptoGains: otherIncome.cryptoGains,
    rentalIncome: otherIncome.rentalIncome,
    otherIncome: otherIncome.otherIncome,
    govBondExcluded: otherIncome.govBondIncome,
  };
  const cassResident = calcCASS(cassBreakdownResident, fiscalYear);

  // 3. CASS for nonresident scenario (net anual)
  const cassBreakdownNonresident: CASSIncomeBreakdown = {
    capitalGainsResident: 0,
    capitalGainsNonResident: Math.max(0, nonresidentResult.netGain),
    dividendsNet: dividendsNetForCASS,
    interestNet: otherIncome.interestIncome,
    cryptoGains: otherIncome.cryptoGains,
    rentalIncome: otherIncome.rentalIncome,
    otherIncome: otherIncome.otherIncome,
    govBondExcluded: otherIncome.govBondIncome,
  };
  const cassNonresident = calcCASS(cassBreakdownNonresident, fiscalYear);

  // 4. Build comparison sides
  const residentTotal = Math.round((residentResult.tax + cassResident.amount) * 100) / 100;
  const nonresidentTotal = Math.round((nonresidentResult.tax + cassNonresident.amount) * 100) / 100;

  const residentGrossGain = residentResult.totalGrossGain;
  const nonresidentGrossGain = nonresidentResult.totalGrossGain;

  const resident: BrokerComparisonSide = {
    regime: 'resident',
    label: 'Broker RO',
    capitalGainResult: residentResult,
    cassResult: cassResident,
    totalCapitalGainsTax: Math.round(residentResult.tax * 100) / 100,
    totalCASS: cassResident.amount,
    totalDue: residentTotal,
    effectiveTaxRate: residentGrossGain > 0
      ? Math.round((residentTotal / residentGrossGain) * 10000) / 100
      : 0,
    d212RequiredForTax: false,
  };

  const nonresident: BrokerComparisonSide = {
    regime: 'nonresident',
    label: 'Broker Strain',
    capitalGainResult: nonresidentResult,
    cassResult: cassNonresident,
    totalCapitalGainsTax: Math.round(nonresidentResult.tax * 100) / 100,
    totalCASS: cassNonresident.amount,
    totalDue: nonresidentTotal,
    effectiveTaxRate: nonresidentGrossGain > 0
      ? Math.round((nonresidentTotal / nonresidentGrossGain) * 10000) / 100
      : 0,
    d212RequiredForTax: true,
  };

  // 5. Savings and winner
  const savings = Math.round((nonresidentTotal - residentTotal) * 100) / 100;
  const cheaperRegime = savings > 0 ? 'resident' as const
    : savings < 0 ? 'nonresident' as const
    : 'equal' as const;

  // 6. Insights
  const insights = generateInsights(
    fiscalYear,
    residentResult,
    nonresidentResult,
    cassResident,
    cassNonresident,
    savings,
    cheaperRegime
  );

  const sellTransactions = allTransactions.filter(t => t.type === 'sell');

  return {
    fiscalYear,
    resident,
    nonresident,
    savings,
    cheaperRegime,
    transactionCount: sellTransactions.length,
    lotCount: residentResult.lots.length,
    insights,
  };
}

function generateInsights(
  fiscalYear: FiscalYear,
  residentResult: ReturnType<typeof calcCapitalGainsResident>,
  nonresidentResult: ReturnType<typeof calcCapitalGainsNonResident>,
  cassResident: ReturnType<typeof calcCASS>,
  cassNonresident: ReturnType<typeof calcCASS>,
  savings: number,
  cheaperRegime: 'resident' | 'nonresident' | 'equal'
): ComparisonInsight[] {
  const insights: ComparisonInsight[] = [];
  const rates = RATES_RESIDENT[fiscalYear];
  const rateNR = RATES_NONRESIDENT[fiscalYear];

  // Rate info
  insights.push({
    type: 'info',
    regime: 'both',
    message: `Cote ${fiscalYear}: Broker RO = ${(rates.long * 100).toFixed(0)}% (detinere \u2265 1 an) / ${(rates.short * 100).toFixed(0)}% (detinere < 1 an) per tranzactie \u2022 Broker strain = ${(rateNR * 100).toFixed(0)}% pe castigul net anual.`,
  });

  // Loss handling
  if (residentResult.totalLoss > 0) {
    insights.push({
      type: 'advantage',
      regime: 'nonresident',
      message: `Ai pierderi de ${Math.round(residentResult.totalLoss).toLocaleString('ro-RO')} lei. La broker strain, acestea se scad din castiguri (compensare). La broker RO, pierderile sunt definitive si nu reduc impozitul.`,
    });
  }

  // Loss carry-forward
  if (nonresidentResult.newCarriedLoss > 0) {
    insights.push({
      type: 'advantage',
      regime: 'nonresident',
      message: `La broker strain, pierderea neta de ${Math.round(nonresidentResult.newCarriedLoss).toLocaleString('ro-RO')} lei se reporteaza in urmatorii 5 ani (max 70% compensare/an). La broker RO, aceasta s-ar pierde complet.`,
    });
  }

  // Carried losses applied
  if (nonresidentResult.carriedLossApplied > 0) {
    insights.push({
      type: 'advantage',
      regime: 'nonresident',
      message: `La broker strain, s-au aplicat ${Math.round(nonresidentResult.carriedLossApplied).toLocaleString('ro-RO')} lei pierderi reportate din anii anteriori, reducand castigul impozabil.`,
    });
  }

  // Long holding advantage
  const longLots = residentResult.lots.filter(l => l.holdingDays >= 365 && l.gainRON > 0);
  if (longLots.length > 0) {
    const longGain = longLots.reduce((s, l) => s + l.gainRON, 0);
    insights.push({
      type: 'advantage',
      regime: 'resident',
      message: `${longLots.length} loturi cu detinere >= 365 zile (castig: ${Math.round(longGain).toLocaleString('ro-RO')} lei) beneficiaza de cota redusa ${(rates.long * 100).toFixed(0)}% la broker RO, vs ${(rateNR * 100).toFixed(0)}% la broker strain.`,
    });
  }

  // CASS difference
  const cassDiff = Math.round(cassResident.amount - cassNonresident.amount);
  if (cassDiff !== 0) {
    const cassWinner = cassDiff > 0 ? 'nonresident' : 'resident';
    insights.push({
      type: 'warning',
      regime: cassWinner,
      message: `CASS difera cu ${Math.abs(cassDiff).toLocaleString('ro-RO')} lei. Broker RO: baza CASS = castig brut (${Math.round(cassResident.totalNonSalaryIncome).toLocaleString('ro-RO')} lei). Broker strain: baza CASS = castig net (${Math.round(cassNonresident.totalNonSalaryIncome).toLocaleString('ro-RO')} lei).`,
    });
  }

  // D212
  insights.push({
    type: 'info',
    regime: 'nonresident',
    message: 'La broker strain, Declaratia Unica (D212) este obligatorie pentru impozitul pe venit. La broker RO, D212 e necesara doar daca venitul non-salarial depaseste 24.300 lei (pentru CASS).',
  });

  // Winner summary
  if (cheaperRegime !== 'equal') {
    const winner = cheaperRegime === 'resident' ? 'Broker RO' : 'Broker Strain';
    insights.push({
      type: 'advantage',
      regime: cheaperRegime,
      message: `${winner} e mai avantajos cu ${Math.abs(savings).toLocaleString('ro-RO')} lei in total (impozit capital + CASS) pentru tranzactiile tale din ${fiscalYear}.`,
    });
  }

  return insights;
}
