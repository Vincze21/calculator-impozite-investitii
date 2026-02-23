import type { NormalizedTransaction } from '@/types/transaction';
import type { MatchedLot, CapitalGainResult, FiscalYear, LossCarryForward } from '@/types/tax';
import { RATES_RESIDENT, RATES_NONRESIDENT } from '@/lib/constants';
import { matchFIFO } from './fifo';
import { applyLossCarryForward } from './loss-carry';

/**
 * Regim A — Broker REZIDENT
 * Impozit retinut la sursa per tranzactie.
 * Pierderile = DEFINITIVE (necompensabile).
 */
export function calcCapitalGainsResident(
  transactions: NormalizedTransaction[],
  year: FiscalYear,
  brokerId: string,
  exchangeRates: Map<string, number>
): CapitalGainResult {
  const rates = RATES_RESIDENT[year];
  const { lots, warnings: _warnings } = matchFIFO(transactions, exchangeRates);

  let totalGrossGain = 0;
  let totalLoss = 0;

  for (const lot of lots) {
    const rate = lot.holdingDays >= 365 ? rates.long : rates.short;
    lot.taxRate = rate;

    if (lot.gainRON > 0) {
      lot.taxAmount = Math.round(lot.gainRON * rate * 100) / 100;
      totalGrossGain += lot.gainRON;
    } else {
      lot.taxAmount = 0; // pierdere definitiva
      totalLoss += Math.abs(lot.gainRON);
    }
  }

  const totalTax = lots.reduce((sum, l) => sum + l.taxAmount, 0);

  return {
    brokerId,
    brokerType: 'resident',
    lots,
    totalGrossGain,
    totalLoss,
    netGain: totalGrossGain - totalLoss,
    carriedLossApplied: 0,
    taxableGain: totalGrossGain, // tax is per profitable transaction only
    tax: Math.round(totalTax * 100) / 100,
    newCarriedLoss: 0, // pierderi definitive, necompensabile
  };
}

/**
 * Regim B — Broker NEREZIDENT
 * Auto-impunere prin D212. Pierderi compensabile.
 * Calcul net anual (gains - losses - carried losses).
 */
export function calcCapitalGainsNonResident(
  transactions: NormalizedTransaction[],
  year: FiscalYear,
  brokerId: string,
  carriedLosses: LossCarryForward[],
  exchangeRates: Map<string, number>
): CapitalGainResult {
  const rate = RATES_NONRESIDENT[year];
  const { lots, warnings: _warnings } = matchFIFO(transactions, exchangeRates);

  let totalGrossGain = 0;
  let totalLoss = 0;

  for (const lot of lots) {
    lot.taxRate = rate;
    if (lot.gainRON > 0) {
      totalGrossGain += lot.gainRON;
    } else {
      totalLoss += Math.abs(lot.gainRON);
    }
  }

  const netGain = totalGrossGain - totalLoss;

  if (netGain <= 0) {
    // Net loss — carry forward
    for (const lot of lots) {
      lot.taxAmount = 0;
    }

    return {
      brokerId,
      brokerType: 'nonresident',
      lots,
      totalGrossGain,
      totalLoss,
      netGain,
      carriedLossApplied: 0,
      taxableGain: 0,
      tax: 0,
      newCarriedLoss: Math.abs(netGain),
    };
  }

  // Apply carried losses
  const { taxableGain, appliedLoss } = applyLossCarryForward(netGain, carriedLosses, year);

  const tax = Math.round(taxableGain * rate * 100) / 100;

  // Distribute tax across profitable lots proportionally
  const profitableLots = lots.filter(l => l.gainRON > 0);
  const totalProfit = profitableLots.reduce((s, l) => s + l.gainRON, 0);
  for (const lot of lots) {
    if (lot.gainRON > 0 && totalProfit > 0) {
      lot.taxAmount = Math.round((lot.gainRON / totalProfit) * tax * 100) / 100;
    } else {
      lot.taxAmount = 0;
    }
  }

  return {
    brokerId,
    brokerType: 'nonresident',
    lots,
    totalGrossGain,
    totalLoss,
    netGain,
    carriedLossApplied: appliedLoss,
    taxableGain,
    tax,
    newCarriedLoss: 0,
  };
}
