const ratesCache = new Map<string, Record<string, number>>();

export async function fetchDailyRates(date: string): Promise<Record<string, number>> {
  const cacheKey = `daily_${date}`;
  if (ratesCache.has(cacheKey)) return ratesCache.get(cacheKey)!;

  const response = await fetch(`/api/bnr?date=${date}`);
  if (!response.ok) throw new Error('Nu pot obtine cursurile BNR');
  const data = await response.json();
  ratesCache.set(cacheKey, data);
  return data;
}

export async function fetchAnnualAverageRates(year: number): Promise<Record<string, number>> {
  const cacheKey = `avg_${year}`;
  if (ratesCache.has(cacheKey)) return ratesCache.get(cacheKey)!;

  const response = await fetch(`/api/bnr?year=${year}&avg=true`);
  if (!response.ok) throw new Error(`Nu pot obtine cursurile medii BNR pentru ${year}`);
  const data = await response.json();
  ratesCache.set(cacheKey, data);
  return data;
}

export function clearRatesCache(): void {
  ratesCache.clear();
}
