import { fetchDailyRates, fetchAnnualAverageRates } from './rates';

export async function convertToRON(
  amount: number,
  currency: string,
  date: string
): Promise<number> {
  if (currency === 'RON') return amount;

  const rates = await fetchDailyRates(date);
  const rate = rates[currency];
  if (!rate) {
    throw new Error(`Curs BNR indisponibil pentru ${currency} la data ${date}`);
  }
  return Math.round(amount * rate * 100) / 100;
}

export async function convertToRONAnnualAvg(
  amount: number,
  currency: string,
  year: number
): Promise<number> {
  if (currency === 'RON') return amount;

  const rates = await fetchAnnualAverageRates(year);
  const rate = rates[currency];
  if (!rate) {
    throw new Error(`Curs mediu anual BNR indisponibil pentru ${currency} in ${year}`);
  }
  return Math.round(amount * rate * 100) / 100;
}

export function roundToRON(amount: number): number {
  return Math.round(amount);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
