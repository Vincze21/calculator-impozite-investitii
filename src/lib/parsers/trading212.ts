import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedTransaction,
  NormalizedDividend,
  NormalizedInterest,
  InstrumentType,
  ParseResult,
} from './types';

// ── Known sets for instrument classification ──

const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'LINK',
  'SOL', 'DOGE', 'AVAX', 'MATIC', 'BNB', 'SHIB',
]);

const ETF_NAME_KEYWORDS = [
  'ETF', 'UCITS', 'ISHARES', 'VANGUARD', 'AMUNDI', 'XTRACKERS',
  'SPDR', 'LYXOR', 'INVESCO', 'WISDOMTREE',
];

// ── Helpers ──

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

function classifyInstrument(ticker: string, isin: string, name: string): InstrumentType {
  const upperTicker = ticker.toUpperCase().split('.')[0];
  const upperName = name.toUpperCase();

  if (CRYPTO_TICKERS.has(upperTicker)) return 'crypto';

  if (ETF_NAME_KEYWORDS.some(kw => upperName.includes(kw))) {
    if (upperName.includes('DIST')) return 'etf_dist';
    return 'etf_acc';
  }

  // ISIN-based ETF detection (IE-domiciled funds are almost always UCITS ETFs)
  if (isin && (isin.startsWith('IE') || isin.startsWith('LU')) && upperName.includes('FUND')) {
    return 'etf_acc';
  }

  return 'stock';
}

function extractCountry(isin: string): string {
  if (!isin || isin.length < 2) return 'US';
  return isin.substring(0, 2).toUpperCase();
}

type T212Action = 'buy' | 'sell' | 'dividend' | 'interest_lending' | 'interest_cash' | 'skip';

function classifyAction(action: string): T212Action {
  const lower = action.toLowerCase().trim();
  if (lower.includes('buy')) return 'buy';
  if (lower.includes('sell')) return 'sell';
  if (lower.includes('dividend')) return 'dividend';
  if (lower === 'lending interest' || lower === 'share lending interest') return 'interest_lending';
  if (lower === 'interest on cash') return 'interest_cash';
  // Deposits, withdrawals, currency conversions, stock splits
  return 'skip';
}

/**
 * Parser for Trading 212 CSV export.
 *
 * Each row = one action (buy, sell, dividend, interest, etc.)
 * Commission is 0 (T212 is commission-free).
 * Dividends include WHT in a separate column.
 */
export function parseTrading212(content: string): ParseResult {
  const lines = content.split('\n').filter(l => l.trim());
  const transactions: NormalizedTransaction[] = [];
  const dividends: NormalizedDividend[] = [];
  const interests: NormalizedInterest[] = [];
  const warnings: string[] = [];

  if (lines.length < 2) {
    throw new Error('Fisierul Trading 212 este gol sau nu contine date.');
  }

  const headers = parseCSVLine(lines[0]);

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let mainCurrency = 'EUR';
  const seenIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    if (row.length < 5) continue;

    try {
      const action = getCol(headers, row, 'Action');
      const actionType = classifyAction(action);
      if (actionType === 'skip') continue;

      const time = getCol(headers, row, 'Time');
      const isin = getCol(headers, row, 'ISIN');
      const ticker = getCol(headers, row, 'Ticker');
      const name = getCol(headers, row, 'Name');
      const shares = getCol(headers, row, 'No. of shares');
      const pricePerShare = getCol(headers, row, 'Price / share');
      const currencyPrice = getCol(headers, row, 'Currency (Price / share)');
      const exchangeRate = getCol(headers, row, 'Exchange rate');
      const total = getCol(headers, row, 'Total');
      const currencyTotal = getCol(headers, row, 'Currency (Total)');
      const wht = getCol(headers, row, 'Withholding tax');
      const chargeAmount = getCol(headers, row, 'Charge amount');
      const t212Id = getCol(headers, row, 'ID');

      // Deduplicate by Trading 212 ID
      if (t212Id) {
        if (seenIds.has(t212Id)) {
          warnings.push(`Tranzactie duplicata ignorata (ID: ${t212Id})`);
          continue;
        }
        seenIds.add(t212Id);
      }

      const date = new Date(time.trim());
      if (isNaN(date.getTime())) {
        warnings.push(`Rand ${i + 1}: data invalida — ${time}`);
        continue;
      }

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      switch (actionType) {
        case 'buy':
        case 'sell': {
          const qty = parseFloat(shares);
          const price = parseFloat(pricePerShare);
          const totalAmt = parseFloat(total);
          const commission = parseFloat(chargeAmount) || 0;

          if (isNaN(qty) || qty === 0) {
            warnings.push(`Rand ${i + 1}: cantitate invalida — ${shares}`);
            continue;
          }

          const currency = currencyPrice || currencyTotal || 'EUR';
          if (currency !== 'RON') mainCurrency = currency;

          transactions.push({
            id: uuidv4(),
            date,
            type: actionType,
            symbol: ticker,
            isin: isin || undefined,
            quantity: Math.abs(qty),
            pricePerUnit: Math.abs(price),
            totalAmount: Math.abs(totalAmt) || Math.abs(qty * price),
            commission: Math.abs(commission),
            currency,
            exchangeRate: parseFloat(exchangeRate) || undefined,
            instrumentType: classifyInstrument(ticker, isin, name),
          });
          break;
        }

        case 'dividend': {
          const grossAmount = Math.abs(parseFloat(total));
          const whtAmount = Math.abs(parseFloat(wht)) || 0;
          const currency = currencyTotal || 'EUR';
          const country = extractCountry(isin);

          if (isNaN(grossAmount) || grossAmount === 0) {
            warnings.push(`Rand ${i + 1}: dividend fara suma — ${ticker}`);
            continue;
          }

          dividends.push({
            id: uuidv4(),
            date,
            symbol: ticker,
            grossAmount,
            whtAmount,
            netAmount: grossAmount - whtAmount,
            currency,
            country,
          });
          break;
        }

        case 'interest_lending':
        case 'interest_cash': {
          const amount = Math.abs(parseFloat(total));
          const whtAmount = Math.abs(parseFloat(wht)) || 0;
          const currency = currencyTotal || 'EUR';

          if (isNaN(amount) || amount === 0) continue;

          interests.push({
            id: uuidv4(),
            date,
            grossAmount: amount,
            whtAmount,
            currency,
            source: actionType === 'interest_lending' ? 'other' : 'cash_interest',
          });
          break;
        }
      }
    } catch {
      warnings.push(`Rand ${i + 1} neparsabil: ${line.substring(0, 80)}`);
    }
  }

  return {
    broker: 'trading212',
    transactions,
    dividends,
    interests,
    warnings,
    currency: mainCurrency,
    period: {
      from: minDate ?? new Date(),
      to: maxDate ?? new Date(),
    },
  };
}
