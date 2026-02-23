import { NextRequest, NextResponse } from 'next/server';

interface BNRRate {
  currency: string;
  rate: number;
  multiplier: number;
}

interface YearlyData {
  /** Map<"YYYY-MM-DD", Record<currency, rateRON>> */
  allDays: Map<string, Record<string, number>>;
  /** Sorted ascending for binary-search fallback on weekends/holidays */
  sortedDates: string[];
  /** Precomputed annual averages per currency */
  averages: Record<string, number>;
  timestamp: number;
}

function parseXMLRates(xml: string): BNRRate[] {
  const rates: BNRRate[] = [];
  const rateRegex = /<Rate currency="([^"]+)"(?: multiplier="(\d+)")?>([^<]+)<\/Rate>/g;
  let match;
  while ((match = rateRegex.exec(xml)) !== null) {
    rates.push({
      currency: match[1],
      rate: parseFloat(match[3]),
      multiplier: match[2] ? parseInt(match[2]) : 1,
    });
  }
  return rates;
}

function getEffectiveRate(rate: BNRRate): number {
  return rate.rate / rate.multiplier;
}

// Cache per year — one fetch covers all daily lookups + annual average for that year
const yearlyCache = new Map<string, YearlyData>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/**
 * Fetch and parse the BNR yearly XML, caching the result.
 * Returns all daily rates + precomputed averages.
 */
async function getYearlyData(year: string): Promise<YearlyData> {
  const cached = yearlyCache.get(year);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  const url = `https://www.bnr.ro/files/xml/years/nbrfxrates${year}.xml`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`BNR nu are date pentru anul ${year}`);
  }
  const xml = await response.text();

  // Parse all <Cube date="YYYY-MM-DD"> blocks
  const allDays = new Map<string, Record<string, number>>();
  const cubeRegex = /<Cube date="(\d{4}-\d{2}-\d{2})">([^]*?)<\/Cube>/g;
  const accumulator: Record<string, number[]> = {};
  let cubeMatch;

  while ((cubeMatch = cubeRegex.exec(xml)) !== null) {
    const cubeDate = cubeMatch[1];
    const dayRates = parseXMLRates(cubeMatch[2]);
    const dayResult: Record<string, number> = {};

    for (const r of dayRates) {
      const effective = getEffectiveRate(r);
      dayResult[r.currency] = effective;

      if (!accumulator[r.currency]) accumulator[r.currency] = [];
      accumulator[r.currency].push(effective);
    }

    allDays.set(cubeDate, dayResult);
  }

  // Sorted dates for binary-search fallback
  const sortedDates = [...allDays.keys()].sort();

  // Precompute averages
  const averages: Record<string, number> = {};
  for (const [currency, values] of Object.entries(accumulator)) {
    averages[currency] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000;
  }

  const data: YearlyData = { allDays, sortedDates, averages, timestamp: Date.now() };
  yearlyCache.set(year, data);
  return data;
}

/**
 * Find the closest business day <= targetDate in sortedDates.
 * BNR doesn't publish rates on weekends/holidays, so we fall back to the last business day.
 */
function findClosestDate(sortedDates: string[], targetDate: string): string | null {
  if (sortedDates.length === 0) return null;

  // Binary search for the largest date <= targetDate
  let lo = 0;
  let hi = sortedDates.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sortedDates[mid] <= targetDate) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result >= 0 ? sortedDates[result] : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const year = searchParams.get('year');
  const avg = searchParams.get('avg');

  try {
    // Annual average rates
    if (avg === 'true' && year) {
      const data = await getYearlyData(year);
      return NextResponse.json(data.averages);
    }

    // Daily rate for a specific date
    if (date) {
      const dateYear = date.substring(0, 4);
      const data = await getYearlyData(dateYear);

      // Exact match or closest business day
      let rates = data.allDays.get(date);
      if (!rates) {
        const closest = findClosestDate(data.sortedDates, date);
        if (closest) {
          rates = data.allDays.get(closest);
        }
      }

      if (!rates) {
        return NextResponse.json(
          { error: `Nu exista curs BNR pentru data ${date} sau anterioara in anul ${dateYear}` },
          { status: 404 }
        );
      }

      return NextResponse.json(rates);
    }

    // Default: latest rates (current day feed)
    const url = `https://www.bnr.ro/nbrfxrates.xml`;
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: 'Nu pot accesa cursurile BNR' }, { status: 502 });
    }
    const xml = await response.text();
    const rates = parseXMLRates(xml);
    const result: Record<string, number> = {};
    for (const r of rates) {
      result[r.currency] = getEffectiveRate(r);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Eroare la obtinerea cursurilor BNR', details: String(error) },
      { status: 500 }
    );
  }
}
