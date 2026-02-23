import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedTransaction,
  InstrumentType,
  ParseResult,
} from './types';

const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'LINK', 'SOL', 'DOGE', 'AVAX', 'MATIC'];

function classifyInstrument(symbol: string): InstrumentType {
  if (CRYPTO_SYMBOLS.some(c => symbol.toUpperCase().startsWith(c))) return 'crypto';
  return 'cfd';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function getCol(headers: string[], row: string[], name: string): string {
  const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  return idx >= 0 && idx < row.length ? row[idx].trim() : '';
}

/**
 * Parser for AvaTrade MT5 History CSV.
 *
 * Each row = one closed position (CFD) with pre-calculated Profit.
 * We convert each position into a synthetic buy+sell pair for the FIFO engine.
 */
export function parseAvaTrade(content: string): ParseResult {
  const lines = content.split('\n').filter(l => l.trim());
  const transactions: NormalizedTransaction[] = [];
  const warnings: string[] = [];

  if (lines.length < 2) {
    throw new Error('Fisierul AvaTrade este gol sau nu contine date.');
  }

  const headers = parseCSVLine(lines[0]);

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip summary rows at the bottom
    const lower = line.toLowerCase();
    if (
      lower.startsWith('closed positions') ||
      lower.startsWith('total ')
    ) {
      continue;
    }

    const row = parseCSVLine(line);
    if (row.length < 10) continue;

    try {
      const symbol = getCol(headers, row, 'Symbol');
      const positionId = getCol(headers, row, 'Position ID');
      const posType = getCol(headers, row, 'Type');
      const openTimeStr = getCol(headers, row, 'Open Time');
      const closeTimeStr = getCol(headers, row, 'Close Time');
      const profit = parseFloat(getCol(headers, row, 'Profit'));
      const commission = parseFloat(getCol(headers, row, 'Commission') || '0');
      const swap = parseFloat(getCol(headers, row, 'Swap') || '0');

      if (!symbol || isNaN(profit)) {
        warnings.push(`Rand ${i + 1}: date incomplete — ${line.substring(0, 80)}`);
        continue;
      }

      const openTime = new Date(openTimeStr);
      const closeTime = new Date(closeTimeStr);

      if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
        warnings.push(`Rand ${i + 1}: data invalida — ${openTimeStr} / ${closeTimeStr}`);
        continue;
      }

      if (!minDate || openTime < minDate) minDate = openTime;
      if (!maxDate || closeTime > maxDate) maxDate = closeTime;

      // Costs = |commission| + |swap|
      const costs = Math.abs(commission) + Math.abs(swap);
      const instrumentType = classifyInstrument(symbol);

      // Use position-unique symbol to prevent FIFO cross-matching
      const uniqueSymbol = `${symbol} #${positionId}`;

      // Determine which transaction is "buy" and which is "sell"
      // For a Buy position: buy at open, sell at close
      // For a Sell position: sell at open, buy at close (short)
      const isBuyPosition = posType.toLowerCase() === 'buy';

      let buyPrice: number;
      let sellPrice: number;

      if (profit >= 0) {
        // Winning position: buy at 0, sell at profit
        buyPrice = 0;
        sellPrice = profit;
      } else {
        // Losing position: buy at |profit|, sell at 0
        buyPrice = Math.abs(profit);
        sellPrice = 0;
      }

      // Buy transaction (at the "open" time of the position)
      transactions.push({
        id: uuidv4(),
        date: isBuyPosition ? openTime : closeTime,
        type: 'buy',
        symbol: uniqueSymbol,
        quantity: 1,
        pricePerUnit: buyPrice,
        totalAmount: buyPrice,
        commission: costs,
        currency: 'USD',
        instrumentType,
      });

      // Sell transaction (at the "close" time of the position)
      transactions.push({
        id: uuidv4(),
        date: isBuyPosition ? closeTime : openTime,
        type: 'sell',
        symbol: uniqueSymbol,
        quantity: 1,
        pricePerUnit: sellPrice,
        totalAmount: sellPrice,
        commission: 0,
        currency: 'USD',
        instrumentType,
      });
    } catch {
      warnings.push(`Rand ${i + 1} neparsabil: ${line.substring(0, 80)}`);
    }
  }

  return {
    broker: 'avatrade',
    transactions,
    dividends: [],
    interests: [],
    warnings,
    currency: 'USD',
    period: {
      from: minDate ?? new Date(),
      to: maxDate ?? new Date(),
    },
  };
}
