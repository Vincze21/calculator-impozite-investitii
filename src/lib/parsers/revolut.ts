import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedTransaction,
  NormalizedDividend,
  InstrumentType,
  ParseResult,
} from './types';

// ── Known sets for instrument classification ──

const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'LINK',
  'SOL', 'DOGE', 'AVAX', 'MATIC', 'BNB', 'SHIB',
]);

const KNOWN_ETF_TICKERS = new Set([
  'VWCE', 'IWDA', 'VWRL', 'CSPX', 'EUNL', 'SWDA', 'IUSQ', 'VUAA',
  'VUSA', 'SXR8', 'ISAC', 'EMIM', 'IS3N', 'VHYL', 'IEMG', 'VTI',
  'VOO', 'SPY', 'QQQ', 'VT', 'VEA', 'VWO', 'SCHD', 'VIG',
]);

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

/**
 * Parse Revolut date formats:
 * - "2025-06-15" or "2025-06-15 14:30:00" (ISO)
 * - "15/06/2025" (DD/MM/YYYY — European, default for RO users)
 * - "15 Jun 2025" or "02 Aug 2023" (PDF format)
 */
function parseRevolutDate(dateStr: string): Date {
  const trimmed = dateStr.trim();

  // ISO: 2025-06-15 or 2025-06-15T14:30:00Z
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS
  const euMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (euMatch) {
    const [, dayOrMonth, monthOrDay, year] = euMatch;
    const a = parseInt(dayOrMonth);
    const b = parseInt(monthOrDay);
    if (a > 12) {
      return new Date(parseInt(year), b - 1, a);
    }
    return new Date(parseInt(year), b - 1, a);
  }

  // "DD Mon YYYY" (e.g. "02 Aug 2023", "15 Jun 2025") — PDF format
  const textMatch = trimmed.match(/^(\d{1,2})\s+(\w{3,})\s+(\d{4})/);
  if (textMatch) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  throw new Error(`Data invalida Revolut: ${dateStr}`);
}

function classifyInstrument(ticker: string): InstrumentType {
  const base = ticker.toUpperCase().split('.')[0];
  if (CRYPTO_TICKERS.has(base)) return 'crypto';
  if (KNOWN_ETF_TICKERS.has(base)) return 'etf_acc';
  return 'stock';
}

function guessCountry(ticker: string): string {
  const parts = ticker.split('.');
  if (parts.length > 1) {
    const exchange = parts[parts.length - 1].toUpperCase();
    const map: Record<string, string> = {
      'US': 'US', 'DE': 'DE', 'AS': 'NL', 'L': 'GB', 'PA': 'FR',
      'MI': 'IT', 'MC': 'ES', 'SW': 'CH', 'TO': 'CA', 'AX': 'AU',
    };
    return map[exchange] || 'US';
  }
  return 'US';
}

type RevolutAction = 'buy' | 'sell' | 'dividend' | 'skip';

function classifyType(type: string): RevolutAction {
  const upper = type.toUpperCase().trim();
  if (upper === 'BUY') return 'buy';
  if (upper === 'SELL') return 'sell';
  if (upper === 'DIVIDEND') return 'dividend';
  return 'skip';
}

// ── Detect format ──

function isCSVFormat(content: string): boolean {
  const firstLine = content.split('\n')[0]?.toLowerCase() ?? '';
  // CSV has comma-separated headers with specific column names
  return (
    (firstLine.includes('ticker') || firstLine.includes('price per share') || firstLine.includes('fx rate')) &&
    firstLine.includes(',')
  );
}

// ── CSV Parser ──

function parseRevolutCSV(content: string): ParseResult {
  const lines = content.split('\n').filter(l => l.trim());
  const transactions: NormalizedTransaction[] = [];
  const dividends: NormalizedDividend[] = [];
  const warnings: string[] = [];

  if (lines.length < 2) {
    throw new Error('Fisierul Revolut CSV este gol sau nu contine date.');
  }

  const headers = parseCSVLine(lines[0]);

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let mainCurrency = 'USD';
  let hasDividends = false;
  let hasStockSplit = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    if (row.length < 4) continue;

    try {
      const typeStr = getCol(headers, row, 'Type');
      const actionType = classifyType(typeStr);

      if (typeStr.toUpperCase().includes('SPLIT') && !hasStockSplit) {
        hasStockSplit = true;
      }

      if (actionType === 'skip') continue;

      const dateStr = getCol(headers, row, 'Date');
      const ticker = getCol(headers, row, 'Ticker');
      const quantity = getCol(headers, row, 'Quantity');
      const pricePerShare = getCol(headers, row, 'Price per share');
      const totalAmount = getCol(headers, row, 'Total Amount');
      const currency = getCol(headers, row, 'Currency') || 'USD';
      const fxRate = getCol(headers, row, 'FX Rate');

      const date = parseRevolutDate(dateStr);

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      if (currency !== 'RON') mainCurrency = currency;

      switch (actionType) {
        case 'buy':
        case 'sell': {
          const qty = parseFloat(quantity);
          const price = parseFloat(pricePerShare);
          const total = parseFloat(totalAmount);

          if (isNaN(qty) || qty === 0) {
            warnings.push(`Rand ${i + 1}: cantitate invalida — ${quantity}`);
            continue;
          }

          transactions.push({
            id: uuidv4(),
            date,
            type: actionType,
            symbol: ticker,
            quantity: Math.abs(qty),
            pricePerUnit: Math.abs(price),
            totalAmount: Math.abs(total) || Math.abs(qty * price),
            commission: 0,
            currency,
            exchangeRate: parseFloat(fxRate) || undefined,
            instrumentType: classifyInstrument(ticker),
          });
          break;
        }

        case 'dividend': {
          const netAmount = Math.abs(parseFloat(totalAmount));
          const country = guessCountry(ticker);

          if (isNaN(netAmount) || netAmount === 0) {
            warnings.push(`Rand ${i + 1}: dividend fara suma — ${ticker}`);
            continue;
          }

          hasDividends = true;

          dividends.push({
            id: uuidv4(),
            date,
            symbol: ticker,
            grossAmount: netAmount,
            whtAmount: 0,
            netAmount,
            currency,
            country,
          });
          break;
        }
      }
    } catch {
      warnings.push(`Rand ${i + 1} neparsabil: ${line.substring(0, 80)}`);
    }
  }

  if (hasDividends) {
    warnings.unshift(
      'ATENTIE: Revolut NU include impozitul retinut la sursa (WHT) in raportul CSV. ' +
      'Dividendele importate contin DOAR suma neta primita. ' +
      'Completati WHT-ul manual in pasul "Dividende" (Step 5). ' +
      'Exemplu: pentru actiuni SUA cu W-8BEN, WHT = 10% din dividendul brut.'
    );
  }

  if (hasStockSplit) {
    warnings.push(
      'Stock split detectat in fisier — nu e eveniment fiscal, dar verificati cantitatile tranzactiilor.'
    );
  }

  return {
    broker: 'revolut',
    transactions,
    dividends,
    interests: [],
    warnings,
    currency: mainCurrency,
    period: {
      from: minDate ?? new Date(),
      to: maxDate ?? new Date(),
    },
  };
}

// ── PDF Text Parser ──

/**
 * Parse text extracted from Revolut Account Statement PDF.
 *
 * PDF has sections like "USD Transactions" / "EUR Transactions" with columns:
 * Date, Symbol, Type, Quantity, Price, Side, Value, Fees, Commission
 *
 * Currency is determined by the section header.
 */
function parseRevolutPDF(content: string): ParseResult {
  const transactions: NormalizedTransaction[] = [];
  const dividends: NormalizedDividend[] = [];
  const warnings: string[] = [];
  const allLines = content.split('\n');

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let mainCurrency = 'USD';
  let hasDividends = false;

  // Extract period from "Period DD Mon YYYY - DD Mon YYYY"
  const periodMatch = content.match(/Period\s+(\d{1,2}\s+\w+\s+\d{4})\s*-\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (periodMatch) {
    try {
      minDate = new Date(periodMatch[1]);
      maxDate = new Date(periodMatch[2]);
    } catch {
      // ignore
    }
  }

  // Find transaction sections: "USD Transactions", "EUR Transactions", etc.
  let currentCurrency = 'USD';

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    const lower = line.toLowerCase();

    // Detect currency section headers
    const currencyMatch = line.match(/^(USD|EUR|GBP|CHF|RON)\s+Transactions/i);
    if (currencyMatch) {
      currentCurrency = currencyMatch[1].toUpperCase();
      if (currentCurrency !== 'RON') mainCurrency = currentCurrency;
      continue;
    }

    // Skip non-data lines (headers, summaries, footers, etc.)
    if (
      lower.includes('account statement') ||
      lower.includes('generated on') ||
      lower.includes('account summary') ||
      lower.includes('portfolio breakdown') ||
      lower.includes('stocks value') ||
      lower.includes('cash value') ||
      lower.includes('% of portfolio') ||
      lower.includes('revolut securities') ||
      lower.includes('get help') ||
      lower.includes('scan the qr') ||
      lower.includes('this statement is') ||
      lower.includes('given revolut') ||
      lower.includes('the value of') ||
      lower === 'total' ||
      !line
    ) {
      continue;
    }

    // Skip the column header row
    if (lower.startsWith('date') && lower.includes('symbol') && lower.includes('type')) {
      continue;
    }

    // Try to parse data rows — they start with a date pattern
    // Formats: "DD/MM/YYYY", "DD Mon YYYY", "YYYY-MM-DD"
    const datePattern = /^(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{1,2}\s+\w{3}\s+\d{4}|\d{4}-\d{2}-\d{2})/;
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    // This looks like a transaction row — parse it
    // PDF tables are typically space-separated when extracted
    const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);

    if (parts.length < 5) {
      // Try splitting by single+ spaces (less reliable but needed for some PDF layouts)
      const spaceParts = line.split(/\s+/).map(p => p.trim()).filter(Boolean);
      if (spaceParts.length < 5) continue;
      // Reassemble: date may have been split — try to detect
      processRevolutPDFRow(spaceParts, currentCurrency, transactions, dividends, warnings, hasDividends);
      continue;
    }

    processRevolutPDFRow(parts, currentCurrency, transactions, dividends, warnings, hasDividends);
  }

  // Update dates from transactions if period wasn't parsed
  for (const tx of transactions) {
    if (!minDate || tx.date < minDate) minDate = tx.date;
    if (!maxDate || tx.date > maxDate) maxDate = tx.date;
  }
  for (const div of dividends) {
    if (!minDate || div.date < minDate) minDate = div.date;
    if (!maxDate || div.date > maxDate) maxDate = div.date;
  }

  if (hasDividends) {
    warnings.unshift(
      'ATENTIE: Revolut NU include impozitul retinut la sursa (WHT) in raportul PDF. ' +
      'Dividendele importate contin DOAR suma neta primita. ' +
      'Completati WHT-ul manual in pasul "Dividende" (Step 5).'
    );
  }

  if (transactions.length === 0 && dividends.length === 0) {
    warnings.push(
      'Nu s-au gasit tranzactii in statement-ul Revolut. ' +
      'Daca contul tau are tranzactii, incearca sa exporti raportul ca CSV din aplicatia Revolut.'
    );
  }

  return {
    broker: 'revolut',
    transactions,
    dividends,
    interests: [],
    warnings,
    currency: mainCurrency,
    period: {
      from: minDate ?? new Date(),
      to: maxDate ?? new Date(),
    },
  };
}

function processRevolutPDFRow(
  parts: string[],
  currency: string,
  transactions: NormalizedTransaction[],
  dividends: NormalizedDividend[],
  warnings: string[],
  hasDividendsRef: boolean
): void {
  // Expected order: Date, Symbol, Type, Quantity, Price, Side, Value, Fees, Commission
  // But PDF text extraction can be messy, so we try to find the components

  try {
    // Find the date (first element that looks like a date)
    let dateStr = '';
    let dateEndIdx = 0;

    // Check if first part is a date, or first 2-3 parts form a date (e.g. "15 Jun 2025")
    if (/^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}$/.test(parts[0])) {
      dateStr = parts[0];
      dateEndIdx = 1;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
      dateStr = parts[0];
      dateEndIdx = 1;
    } else if (parts.length >= 3 && /^\d{1,2}$/.test(parts[0]) && /^[A-Za-z]{3,}$/.test(parts[1]) && /^\d{4}$/.test(parts[2])) {
      dateStr = `${parts[0]} ${parts[1]} ${parts[2]}`;
      dateEndIdx = 3;
    } else {
      return; // Not a data row
    }

    const date = parseRevolutDate(dateStr);
    const rest = parts.slice(dateEndIdx);

    if (rest.length < 3) return;

    // rest[0] = Symbol, rest[1] = Type, rest[2+] = numeric fields
    const symbol = rest[0];
    const type = rest[1]?.toUpperCase() || '';

    // Determine action from Type or Side column
    let action: RevolutAction = 'skip';
    if (type === 'BUY' || type === 'SELL' || type === 'DIVIDEND') {
      action = classifyType(type);
    } else {
      // Type might be something else (like "MARKET ORDER"), check Side
      for (let j = 2; j < rest.length; j++) {
        const val = rest[j].toUpperCase();
        if (val === 'BUY' || val === 'SELL') {
          action = classifyType(val);
          break;
        }
      }
    }

    if (action === 'skip') return;

    // Extract numeric values from remaining parts
    const numericValues: number[] = [];
    for (let j = 2; j < rest.length; j++) {
      const cleaned = rest[j].replace(/[,$€£]/g, '').replace(/\s/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) numericValues.push(num);
    }

    // Expected: Quantity, Price, Value (at minimum)
    if (numericValues.length < 2) return;

    const quantity = numericValues[0];
    const price = numericValues[1];
    // Value might be at index 2 or 3 (if Side took a slot)
    const value = numericValues.length >= 3 ? numericValues[2] : quantity * price;
    const fees = numericValues.length >= 4 ? numericValues[3] : 0;
    const commission = numericValues.length >= 5 ? numericValues[4] : 0;

    switch (action) {
      case 'buy':
      case 'sell':
        transactions.push({
          id: uuidv4(),
          date,
          type: action,
          symbol,
          quantity: Math.abs(quantity),
          pricePerUnit: Math.abs(price),
          totalAmount: Math.abs(value),
          commission: Math.abs(fees) + Math.abs(commission),
          currency,
          instrumentType: classifyInstrument(symbol),
        });
        break;

      case 'dividend': {
        const netAmount = Math.abs(value) || Math.abs(price);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        hasDividendsRef = true;
        dividends.push({
          id: uuidv4(),
          date,
          symbol,
          grossAmount: netAmount,
          whtAmount: 0,
          netAmount,
          currency,
          country: guessCountry(symbol),
        });
        break;
      }
    }
  } catch {
    warnings.push(`Rand PDF neparsabil: ${parts.join(' ').substring(0, 80)}`);
  }
}

// ── Main entry point ──

/**
 * Parser for Revolut exports — auto-detects CSV vs PDF text format.
 */
export function parseRevolut(content: string): ParseResult {
  if (isCSVFormat(content)) {
    return parseRevolutCSV(content);
  }
  return parseRevolutPDF(content);
}
