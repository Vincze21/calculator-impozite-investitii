import type { FiscalYear, CASSResult } from '@/types/tax';
import { CASS_RATE, getCassThresholds } from '@/lib/constants';

export interface CASSIncomeBreakdown {
  capitalGainsResident: number;    // brut per tranzactie profitabila
  capitalGainsNonResident: number; // net anual
  dividendsNet: number;            // dupa impozit la sursa
  interestNet: number;             // dobanzi nete
  cryptoGains: number;
  rentalIncome: number;
  otherIncome: number;
  govBondExcluded: number;         // titluri de stat — se afiseaza dar NU se include
}

/**
 * Calculeaza CASS (Contributie Sanatate) — 10% pe plafoane fixe.
 *
 * Plafoane 2025/2026 (SMB = 4050):
 *   < 24.300 lei → 0 lei CASS
 *   24.300 - 48.599 lei → 2.430 lei (10% × 24.300)
 *   48.600 - 97.199 lei → 4.860 lei (10% × 48.600)
 *   >= 97.200 lei → 9.720 lei (10% × 97.200) = PLAFON MAXIM
 *
 * Ce INTRA: castiguri capital, dividende, dobanzi, crypto, chirii, alte venituri extrasalariale
 * Ce NU intra: titluri de stat (Fidelis, Tezaur), salarii
 */
export function calcCASS(breakdown: CASSIncomeBreakdown, year: FiscalYear): CASSResult {
  const thresholds = getCassThresholds(year);

  const totalNonSalaryIncome =
    breakdown.capitalGainsResident +
    breakdown.capitalGainsNonResident +
    breakdown.dividendsNet +
    breakdown.interestNet +
    breakdown.cryptoGains +
    breakdown.rentalIncome +
    breakdown.otherIncome;
  // govBondExcluded NOT included

  let base: number;
  let threshold: number;

  if (totalNonSalaryIncome < thresholds[0]) {
    base = 0;
    threshold = thresholds[0];
  } else if (totalNonSalaryIncome < thresholds[1]) {
    base = thresholds[0];
    threshold = thresholds[1];
  } else if (totalNonSalaryIncome < thresholds[2]) {
    base = thresholds[1];
    threshold = thresholds[2];
  } else {
    base = thresholds[2];
    threshold = thresholds[2];
  }

  const amount = Math.round(base * CASS_RATE * 100) / 100;

  return {
    totalNonSalaryIncome: Math.round(totalNonSalaryIncome * 100) / 100,
    threshold,
    base,
    amount,
    breakdown,
  };
}
