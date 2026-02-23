'use client';

import { useState, useCallback } from 'react';
import { fetchDailyRates, fetchAnnualAverageRates } from '@/lib/bnr/rates';

export function useBNRRates() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRates, setDailyRates] = useState<Map<string, number>>(new Map());
  const [annualAvgRates, setAnnualAvgRates] = useState<Record<string, number>>({});

  const fetchRatesForDates = useCallback(async (dates: string[], currencies: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const newRates = new Map(dailyRates);
      const uniqueDates = [...new Set(dates)];

      for (const date of uniqueDates) {
        const rates = await fetchDailyRates(date);
        for (const currency of currencies) {
          if (rates[currency]) {
            newRates.set(`${currency}_${date}`, rates[currency]);
          }
        }
      }

      setDailyRates(newRates);
      return newRates;
    } catch (err) {
      setError(String(err));
      return dailyRates;
    } finally {
      setLoading(false);
    }
  }, [dailyRates]);

  const fetchAnnualAvg = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const rates = await fetchAnnualAverageRates(year);
      setAnnualAvgRates(rates);
      return rates;
    } catch (err) {
      setError(String(err));
      return annualAvgRates;
    } finally {
      setLoading(false);
    }
  }, [annualAvgRates]);

  return {
    loading,
    error,
    dailyRates,
    annualAvgRates,
    fetchRatesForDates,
    fetchAnnualAvg,
  };
}
