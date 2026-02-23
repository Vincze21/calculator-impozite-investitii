import type { NormalizedDividend } from '@/types/transaction';
import type { DividendResult, DividendTaxDetail, FiscalYear } from '@/types/tax';
import { DIVIDEND_TAX } from '@/lib/constants';

/**
 * Calculeaza impozitul pe dividende straine cu credit fiscal.
 * Dividendele romanesti sunt retinute la sursa — nu se calculeaza aici.
 *
 * Formula:
 *   taxRO = grossDividendRON * DIVIDEND_TAX[year]
 *   taxCredit = min(whtRON, taxRO)
 *   taxDue = max(0, taxRO - taxCredit)
 */
export function calcDividendTax(
  dividends: NormalizedDividend[],
  year: FiscalYear,
  annualAvgRates: Record<string, number>
): DividendResult {
  const taxRate = DIVIDEND_TAX[year];
  const details: DividendTaxDetail[] = [];

  let totalGrossRON = 0;
  let totalTaxRO = 0;
  let totalWHTRON = 0;
  let totalTaxCredit = 0;
  let totalTaxDue = 0;

  for (const div of dividends) {
    const rate = div.currency === 'RON' ? 1 : (annualAvgRates[div.currency] ?? 1);

    const grossRON = Math.round(div.grossAmount * rate * 100) / 100;
    const whtRON = Math.round(div.whtAmount * rate * 100) / 100;
    const taxRO = Math.round(grossRON * taxRate * 100) / 100;
    const taxCredit = Math.min(whtRON, taxRO);
    const taxDue = Math.max(0, taxRO - taxCredit);

    details.push({
      symbol: div.symbol,
      country: div.country,
      grossAmountRON: grossRON,
      taxRO,
      whtRON,
      taxCredit,
      taxDue,
    });

    totalGrossRON += grossRON;
    totalTaxRO += taxRO;
    totalWHTRON += whtRON;
    totalTaxCredit += taxCredit;
    totalTaxDue += taxDue;
  }

  return {
    details,
    totalGrossRON: Math.round(totalGrossRON * 100) / 100,
    totalTaxRO: Math.round(totalTaxRO * 100) / 100,
    totalWHTRON: Math.round(totalWHTRON * 100) / 100,
    totalTaxCredit: Math.round(totalTaxCredit * 100) / 100,
    totalTaxDue: Math.round(totalTaxDue * 100) / 100,
  };
}

/**
 * Calculeaza dividendele nete (dupa impozit la sursa) pentru CASS.
 * Include atat dividende RO cat si straine.
 */
export function calcDividendsNetForCASS(
  dividends: NormalizedDividend[],
  annualAvgRates: Record<string, number>
): number {
  let total = 0;
  for (const div of dividends) {
    const rate = div.currency === 'RON' ? 1 : (annualAvgRates[div.currency] ?? 1);
    total += div.netAmount * rate;
  }
  return Math.round(total * 100) / 100;
}
