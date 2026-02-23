import type { NormalizedTransaction } from '@/types/transaction';
import type { MatchedLot } from '@/types/tax';

interface BuyLot {
  date: Date;
  quantity: number;
  remainingQty: number;
  pricePerUnit: number;
  commission: number;
  currency: string;
  exchangeRate: number;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

/**
 * FIFO matching: for each sell, consume the oldest buys first.
 * Groups transactions by symbol, then matches sells to buys in chronological order.
 */
export function matchFIFO(
  transactions: NormalizedTransaction[],
  exchangeRates: Map<string, number> // key: "CURRENCY_YYYY-MM-DD", value: RON rate
): { lots: MatchedLot[]; warnings: string[] } {
  const lots: MatchedLot[] = [];
  const warnings: string[] = [];

  // Ensure all dates are Date objects (may be strings from JSON/localStorage)
  const normalized = transactions.map(tx => ({
    ...tx,
    date: toDate(tx.date),
  }));

  // Group by symbol
  const bySymbol = new Map<string, NormalizedTransaction[]>();
  for (const tx of normalized) {
    const existing = bySymbol.get(tx.symbol) ?? [];
    existing.push(tx);
    bySymbol.set(tx.symbol, existing);
  }

  for (const [symbol, txs] of bySymbol) {
    // Sort by date ascending
    const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime());

    const buyQueue: BuyLot[] = [];

    for (const tx of sorted) {
      const dateKey = `${tx.currency}_${tx.date.toISOString().split('T')[0]}`;
      const rate = tx.currency === 'RON' ? 1 : (exchangeRates.get(dateKey) ?? tx.exchangeRate ?? 1);

      if (tx.type === 'buy') {
        buyQueue.push({
          date: tx.date,
          quantity: tx.quantity,
          remainingQty: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          commission: tx.commission,
          currency: tx.currency,
          exchangeRate: rate,
        });
      } else {
        // Sell — match against buys FIFO
        let remainingSellQty = tx.quantity;
        const sellCommissionPerUnit = tx.commission / tx.quantity;

        while (remainingSellQty > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0];
          if (buy.remainingQty <= 0) {
            buyQueue.shift();
            continue;
          }

          const matchQty = Math.min(remainingSellQty, buy.remainingQty);
          const buyCommissionPerUnit = buy.commission / buy.quantity;

          // Proportional commission for matched quantity
          const matchBuyCommission = buyCommissionPerUnit * matchQty;
          const matchSellCommission = sellCommissionPerUnit * matchQty;

          const buyValueRON = (buy.pricePerUnit * matchQty + matchBuyCommission) * buy.exchangeRate;
          const sellValueRON = (tx.pricePerUnit * matchQty - matchSellCommission) * rate;
          // fiscalValue = buyPrice + buyCommission + sellCommission
          const fiscalValueRON = (buy.pricePerUnit * matchQty + matchBuyCommission + matchSellCommission) * buy.exchangeRate;

          const gainRON = (tx.pricePerUnit * matchQty) * rate - fiscalValueRON;
          const holdingDays = daysBetween(buy.date, tx.date);

          lots.push({
            symbol,
            buyDate: buy.date,
            sellDate: tx.date,
            quantity: matchQty,
            buyPrice: buy.pricePerUnit,
            sellPrice: tx.pricePerUnit,
            buyCommission: matchBuyCommission,
            sellCommission: matchSellCommission,
            currency: tx.currency,
            exchangeRateBuy: buy.exchangeRate,
            exchangeRateSell: rate,
            holdingDays,
            gainRON,
            taxRate: 0, // will be set by capital-gains
            taxAmount: 0, // will be set by capital-gains
          });

          buy.remainingQty -= matchQty;
          remainingSellQty -= matchQty;

          if (buy.remainingQty <= 0) {
            buyQueue.shift();
          }
        }

        if (remainingSellQty > 0.0001) {
          warnings.push(
            `${symbol}: vanzare de ${remainingSellQty.toFixed(4)} unitati fara achizitie corespondenta (${tx.date.toISOString().split('T')[0]})`
          );
        }
      }
    }
  }

  return { lots, warnings };
}
