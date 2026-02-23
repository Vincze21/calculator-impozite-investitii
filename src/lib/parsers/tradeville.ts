import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedTransaction,
  NormalizedDividend,
  NormalizedInterest,
  InstrumentType,
  ParseResult,
} from './types';

// Known BVB ETFs
const BVB_ETFS = ['TVBETETF', 'ETBK', 'ETRC'];

function detectInstrumentType(ticker: string, extra: string): InstrumentType {
  if (/^R\d{4}[A-Z]$/i.test(ticker)) return 'bond_gov';
  if (BVB_ETFS.includes(ticker.toUpperCase())) return 'etf_acc';
  if (extra.toLowerCase().includes('cupon')) return 'bond_corp';
  if (extra.toLowerCase().includes('ats')) return 'bond_corp';
  return 'stock';
}

/**
 * Parse Romanian number format: 1.234,56 → 1234.56
 */
function parseNum(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Parse various date formats used by TradeVille:
 * - DD.MM.YYYY (CSV "Istoric tranzactii")
 * - YYYY-MM-DD (ISO)
 * - MM/DD/YY HH:MM:SS (PDF "Activitate cont")
 * - MM/DD/YY (PDF without time)
 */
function parseDate(dateStr: string): Date {
  const trimmed = dateStr.trim();

  // DD.MM.YYYY or DD.MM.YYYY HH:MM:SS
  const dotMatch = trimmed.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // MM/DD/YY HH:MM:SS
  const fullMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (fullMatch) {
    const [, month, day, year, hour, min, sec] = fullMatch;
    return new Date(
      2000 + parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(min), parseInt(sec)
    );
  }

  // MM/DD/YY
  const shortMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (shortMatch) {
    const [, month, day, year] = shortMatch;
    return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  throw new Error(`Format data necunoscut: ${dateStr}`);
}

// ─── CSV PARSER ──────────────────────────────────────────

/**
 * Detect the CSV separator (comma, semicolon, or tab).
 */
function detectSeparator(headerLine: string): string {
  if (headerLine.includes('\t')) return '\t';
  if (headerLine.includes(';')) return ';';
  return ',';
}

/**
 * Build a column index map from header names.
 */
function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim();
    map[key] = i;
  });
  return map;
}

/**
 * Get a column value by trying multiple possible column names.
 */
function getCol(row: string[], colMap: Record<string, number>, ...names: string[]): string {
  for (const name of names) {
    const idx = colMap[name];
    if (idx !== undefined && idx < row.length) {
      return row[idx].trim();
    }
  }
  return '';
}

/**
 * Parse TradeVille CSV format.
 * Handles both "Istoric tranzactii" (Data,Simbol,Piata,Sens,...)
 * and "Activitate cont" CSV (Data,Oper,Ticker,...).
 */
function parseTradeVilleCSV(text: string): ParseResult {
  const transactions: NormalizedTransaction[] = [];
  const dividends: NormalizedDividend[] = [];
  const interests: NormalizedInterest[] = [];
  const warnings: string[] = [];

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('Fisierul CSV TradeVille e gol sau are doar header.');
  }

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator);
  const colMap = buildColumnMap(headers);

  // Detect which CSV format we have
  const hasSimbol = colMap['simbol'] !== undefined;
  const hasSens = colMap['sens'] !== undefined;
  const hasOper = colMap['oper'] !== undefined;

  // Determine period from data rows
  let minDate = new Date();
  let maxDate = new Date(0);

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(separator);
    if (parts.length < 3) continue;

    const dateStr = getCol(parts, colMap, 'data', 'date');
    if (!dateStr) {
      warnings.push(`Rand fara data: ${lines[i].substring(0, 80)}`);
      continue;
    }

    let date: Date;
    try {
      date = parseDate(dateStr);
    } catch {
      warnings.push(`Data invalida: ${dateStr}`);
      continue;
    }

    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;

    const symbol = getCol(parts, colMap, 'simbol', 'ticker', 'symbol');
    const market = getCol(parts, colMap, 'piata', 'market');
    const currency = getCol(parts, colMap, 'valuta', 'currency') || 'RON';
    const price = parseNum(getCol(parts, colMap, 'pret', 'price'));
    const quantity = parseNum(getCol(parts, colMap, 'cantitate', 'quantity'));
    const commission = parseNum(getCol(parts, colMap, 'comision', 'commission'));
    const value = parseNum(getCol(parts, colMap, 'valoare', 'valoare net', 'value'));
    const tax = parseNum(getCol(parts, colMap, 'impozit', 'tax'));
    const observatii = getCol(parts, colMap, 'observatii', 'observații', 'nrtz', 'notes');

    // Determine operation type
    let oper: string;
    if (hasSens) {
      const sens = getCol(parts, colMap, 'sens').toLowerCase();
      if (sens.startsWith('cumpar') || sens === 'c') oper = 'cump';
      else if (sens.startsWith('vanzar') || sens.startsWith('vînzar') || sens === 'v') oper = 'vanz';
      else oper = sens;
    } else if (hasOper) {
      oper = getCol(parts, colMap, 'oper').toLowerCase();
    } else {
      warnings.push(`Nu am gasit coloana Sens/Oper: ${lines[i].substring(0, 80)}`);
      continue;
    }

    const instrumentType = detectInstrumentType(symbol, market + ' ' + observatii);

    switch (oper) {
      case 'cump':
      case 'cumparare': {
        transactions.push({
          id: uuidv4(),
          date,
          type: 'buy',
          symbol,
          quantity: Math.abs(quantity),
          pricePerUnit: price,
          totalAmount: Math.abs(value) || Math.abs(price * quantity),
          commission: Math.abs(commission),
          currency,
          instrumentType,
        });
        break;
      }

      case 'vanz':
      case 'vanzare':
      case 'vînzare': {
        transactions.push({
          id: uuidv4(),
          date,
          type: 'sell',
          symbol,
          quantity: Math.abs(quantity),
          pricePerUnit: price,
          totalAmount: Math.abs(value) || Math.abs(price * quantity),
          commission: Math.abs(commission),
          currency,
          instrumentType,
        });
        break;
      }

      case 'div': {
        const grossAmount = Math.abs(value);
        const whtAmount = Math.abs(tax);

        if (observatii.toLowerCase().includes('cupon') || instrumentType === 'bond_corp' || instrumentType === 'bond_gov') {
          interests.push({
            id: uuidv4(),
            date,
            grossAmount,
            whtAmount,
            currency,
            source: 'bond_coupon',
          });
        } else {
          dividends.push({
            id: uuidv4(),
            date,
            symbol,
            grossAmount,
            whtAmount,
            netAmount: grossAmount - whtAmount,
            currency,
            country: 'RO',
          });
        }
        break;
      }

      case 'in': {
        // Deposit — skip
        break;
      }

      case 'comis': {
        warnings.push(`Corectie comision ignorata: ${symbol} ${dateStr} (${value} ${currency})`);
        break;
      }

      default: {
        if (oper && oper !== '') {
          warnings.push(`Operatie necunoscuta "${oper}": ${symbol} ${dateStr}`);
        }
        break;
      }
    }
  }

  return {
    broker: 'tradeville',
    transactions,
    dividends,
    interests,
    warnings,
    currency: 'RON',
    period: { from: minDate, to: maxDate },
  };
}

// ─── PDF TEXT PARSER (OCR) ───────────────────────────────

function extractPeriod(text: string): { from: Date; to: Date } {
  const match = text.match(/Perioada[:\s]*(\d{2}\/\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{2})/i);
  if (!match) return { from: new Date(), to: new Date() };
  return {
    from: parseDate(match[1]),
    to: parseDate(match[2]),
  };
}

interface RawRow {
  date: string;
  oper: string;
  ticker: string;
  price: number;
  quantity: number;
  commission: number;
  netValue: number;
  profitLoss: number;
  tax: number;
  marketFee: number;
  observatii: string;
}

function tryParseRow(parts: string[]): RawRow | null {
  if (parts.length < 7) return null;

  let dateStr = '';
  let restParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (/\d{2}\/\d{2}\/\d{2}/.test(parts[i])) {
      dateStr = parts[i];
      restParts = parts.slice(i + 1);
      break;
    }
  }

  if (!dateStr || restParts.length < 3) return null;

  const operIdx = restParts.findIndex(p =>
    /^(in|cump|vanz|div|comis)$/i.test(p.trim())
  );

  if (operIdx === -1) return null;

  const oper = restParts[operIdx].trim().toLowerCase();
  const ticker = restParts[operIdx + 1]?.trim() || '';
  const numericParts = restParts.slice(operIdx + 2);

  return {
    date: dateStr,
    oper,
    ticker,
    price: parseNum(numericParts[0]),
    quantity: parseNum(numericParts[1]),
    commission: parseNum(numericParts[2]),
    netValue: parseNum(numericParts[3]),
    profitLoss: parseNum(numericParts[4]),
    tax: parseNum(numericParts[5]),
    marketFee: parseNum(numericParts[6]),
    observatii: numericParts.slice(7).join(' ').trim(),
  };
}

function parseTradeVillePDF(text: string): ParseResult {
  const transactions: NormalizedTransaction[] = [];
  const dividends: NormalizedDividend[] = [];
  const interests: NormalizedInterest[] = [];
  const warnings: string[] = [];

  const period = extractPeriod(text);

  console.log('[TradeVille PDF] Text extras (primele 500 caractere):', text.substring(0, 500));

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const headerKeywords = ['data', 'oper', 'ticker', 'pret', 'cantitate', 'comision'];
  const headerIdx = lines.findIndex(l => {
    const lower = l.toLowerCase();
    const matches = headerKeywords.filter(k => lower.includes(k)).length;
    return matches >= 3;
  });

  if (headerIdx === -1) {
    const sample = lines.slice(0, 15).join('\n');
    throw new Error(
      'Nu am putut citi tabelul din PDF-ul TradeVille (calitatea OCR insuficienta).\n\n' +
      'Alternativa: exporta raportul ca CSV din platforma TradeVille:\n' +
      'TradeVille → Portofoliu → Istoric tranzactii → Export CSV\n\n' +
      'Text extras (primele 15 randuri):\n' + sample
    );
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (
      lower.startsWith('taxa piata') ||
      lower.startsWith('comision') ||
      lower.startsWith('sold final') ||
      lower.includes('directiva 2014') ||
      lower.includes('tradeville sa') ||
      lower.includes('costul mediu')
    ) {
      break;
    }

    const parts = line.split(/\t/).map(p => p.trim()).filter(Boolean);
    const row = tryParseRow(parts);
    if (!row) {
      const spaceParts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
      const rowAlt = tryParseRow(spaceParts);
      if (!rowAlt) {
        if (line.trim() && !/^\d{2}:\d{2}:\d{2}$/.test(line.trim())) {
          warnings.push(`Rand neparsabil: ${line.substring(0, 100)}`);
        }
        continue;
      }
      processRow(rowAlt, transactions, dividends, interests, warnings);
      continue;
    }

    processRow(row, transactions, dividends, interests, warnings);
  }

  return {
    broker: 'tradeville',
    transactions,
    dividends,
    interests,
    warnings,
    currency: 'RON',
    period,
  };
}

function processRow(
  row: RawRow,
  transactions: NormalizedTransaction[],
  dividends: NormalizedDividend[],
  interests: NormalizedInterest[],
  warnings: string[]
): void {
  let date: Date;
  try {
    date = parseDate(row.date);
  } catch {
    warnings.push(`Data invalida: ${row.date}`);
    return;
  }

  const instrumentType = detectInstrumentType(row.ticker, row.observatii);

  switch (row.oper) {
    case 'cump': {
      transactions.push({
        id: uuidv4(),
        date,
        type: 'buy',
        symbol: row.ticker,
        quantity: Math.abs(row.quantity),
        pricePerUnit: row.price,
        totalAmount: Math.abs(row.netValue),
        commission: Math.abs(row.commission),
        currency: 'RON',
        instrumentType,
      });
      break;
    }

    case 'vanz': {
      transactions.push({
        id: uuidv4(),
        date,
        type: 'sell',
        symbol: row.ticker,
        quantity: Math.abs(row.quantity),
        pricePerUnit: row.price,
        totalAmount: Math.abs(row.netValue),
        commission: Math.abs(row.commission),
        currency: 'RON',
        instrumentType,
      });
      break;
    }

    case 'div': {
      const grossAmount = Math.abs(row.netValue);
      const whtAmount = Math.abs(row.tax);

      if (row.observatii.toLowerCase().includes('cupon') || instrumentType === 'bond_corp' || instrumentType === 'bond_gov') {
        interests.push({
          id: uuidv4(),
          date,
          grossAmount,
          whtAmount,
          currency: 'RON',
          source: 'bond_coupon',
        });
      } else {
        dividends.push({
          id: uuidv4(),
          date,
          symbol: row.ticker,
          grossAmount,
          whtAmount,
          netAmount: grossAmount - whtAmount,
          currency: 'RON',
          country: 'RO',
        });
      }
      break;
    }

    case 'in': {
      break;
    }

    case 'comis': {
      warnings.push(`Corectie comision ignorata: ${row.ticker} ${row.date} (${row.netValue} RON)`);
      break;
    }

    default: {
      warnings.push(`Operatie necunoscuta "${row.oper}": ${row.ticker} ${row.date}`);
      break;
    }
  }
}

// ─── MAIN ENTRY POINT ───────────────────────────────────

/**
 * Main TradeVille parser. Auto-detects CSV vs PDF text format.
 */
export function parseTradeVille(text: string): ParseResult {
  const header = text.split('\n').slice(0, 5).join('\n').toLowerCase();

  // CSV format: has "Simbol" or "Sens" column headers
  if (header.includes('simbol') || header.includes('sens')) {
    return parseTradeVilleCSV(text);
  }

  // PDF text format (OCR output)
  return parseTradeVillePDF(text);
}
