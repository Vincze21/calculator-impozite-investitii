import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedTransaction,
  NormalizedInterest,
  InstrumentType,
  ParseResult,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUFFIX_CURRENCY: Record<string, string> = {
  US: 'USD', DE: 'EUR', FR: 'EUR', NL: 'EUR', BE: 'EUR',
  IT: 'EUR', ES: 'EUR', PT: 'EUR', FI: 'EUR', AT: 'EUR',
  GB: 'GBP', CH: 'CHF', SE: 'SEK', DK: 'DKK', NO: 'NOK',
  PL: 'PLN', HU: 'HUF', CZ: 'CZK', RO: 'RON', AU: 'AUD',
  JP: 'JPY', CA: 'CAD', SG: 'SGD', HK: 'HKD',
};

const CRYPTO_PREFIXES = ['BTC', 'ETH', 'XRP', 'LTC', 'ADA', 'DOT', 'SOL', 'DOGE', 'BNB', 'AVAX'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** EL.US → EL, BMW.DE → BMW, AUDCHF → AUDCHF */
function cleanSymbol(raw: string): string {
  return raw.replace(/\.[A-Z]{1,3}$/, '').toUpperCase().trim();
}

function detectCurrency(symbol: string): string {
  const match = symbol.match(/\.([A-Z]{2,3})$/);
  if (match) return SUFFIX_CURRENCY[match[1]] ?? 'USD';
  return 'RON';
}

/** AUDCHF, EURUSD — 6 uppercase letters, no dot, not a crypto */
function isForexPair(symbol: string): boolean {
  if (!/^[A-Z]{6}$/.test(symbol)) return false;
  return !CRYPTO_PREFIXES.some(c => symbol.startsWith(c));
}

function classifyInstrument(rawSymbol: string): InstrumentType {
  const clean = cleanSymbol(rawSymbol);
  if (CRYPTO_PREFIXES.some(c => clean.startsWith(c))) return 'crypto';
  if (isForexPair(rawSymbol)) return 'cfd';
  return 'stock';
}

/** Handles "2025-06-20 15:57" (Excel) and "20/06/2025 15:57:58" (PDF) */
function parseXTBDate(v: string): Date | null {
  if (!v || !v.trim()) return null;
  const s = v.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [datePart, timePart] = s.split(' ');
    const [dd, mm, yyyy] = datePart.split('/');
    const iso = `${yyyy}-${mm}-${dd}${timePart ? 'T' + timePart : ''}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function parseNum(v: string | number | undefined | null): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  // Strip currency symbols ($, €, RON etc.), spaces, keep digits/dot/comma/minus
  const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface ClosedPositionRow {
  positionId: string;
  symbol: string;
  type: string;
  volume: number;
  openTime: string;
  openPrice: number;
  closeTime: string;
  closePrice: number;
  purchaseValue: number;
  saleValue: number;
  commission: number;
  swap: number;
  grossPL: number;
}

interface CashOperationRow {
  type: string;
  time: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Core builder — shared by Excel and PDF parsers
// ---------------------------------------------------------------------------

function buildParseResult(
  closedRows: ClosedPositionRow[],
  cashRows: CashOperationRow[],
  /** True when source is XTB Romania (resident broker, values already in RON) */
  isRO = false,
): ParseResult {
  const transactions: NormalizedTransaction[] = [];
  const interests: NormalizedInterest[] = [];
  const warnings: string[] = [];

  // Detect XTB Romania from cash operations (Romania Tax entry = withholding at source)
  const resident = isRO || cashRows.some(r => r.type.toLowerCase().includes('romania'));

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  function updatePeriod(d: Date) {
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  for (const row of closedRows) {
    const rawSymbol = row.symbol;
    if (!rawSymbol) continue;

    const cleanedSymbol = cleanSymbol(rawSymbol);
    const forex = isForexPair(rawSymbol);
    const instrumentType = classifyInstrument(rawSymbol);

    const openDate = parseXTBDate(row.openTime);
    const closeDate = parseXTBDate(row.closeTime);

    if (!openDate || !closeDate) {
      warnings.push(`${rawSymbol} #${row.positionId}: date invalide — ${row.openTime} / ${row.closeTime}`);
      continue;
    }

    updatePeriod(openDate);
    updatePeriod(closeDate);

    if (forex) {
      // CFD Forex: synthetic P/L approach to avoid lot-size complexity.
      // FIX Bug 3: always BUY at openDate, SELL at closeDate regardless of position
      // direction (LONG/SHORT). The synthetic pair only needs BUY < SELL in time for FIFO.
      const uniqueSymbol = `${cleanedSymbol} #${row.positionId}`;
      const costs = Math.abs(row.commission) + Math.abs(row.swap);
      const profit = row.grossPL;

      const buyPrice  = profit >= 0 ? 0 : Math.abs(profit);
      const sellPrice = profit >= 0 ? profit : 0;

      transactions.push({
        id: uuidv4(),
        date: openDate,   // always openDate for BUY
        type: 'buy',
        symbol: uniqueSymbol,
        quantity: 1,
        pricePerUnit: buyPrice,
        totalAmount: buyPrice,
        commission: costs,
        currency: 'RON',
        instrumentType,
      });

      transactions.push({
        id: uuidv4(),
        date: closeDate,  // always closeDate for SELL
        type: 'sell',
        symbol: uniqueSymbol,
        quantity: 1,
        pricePerUnit: sellPrice,
        totalAmount: sellPrice,
        commission: 0,
        currency: 'RON',
        instrumentType,
      });

      if (profit !== 0) {
        warnings.push(
          `${cleanedSymbol}: instrument forex CFD — ` +
          `impozit calculat din P/L brut (${profit >= 0 ? '+' : ''}${profit.toFixed(2)} RON)`
        );
      }
    } else {
      // Stock / ETF
      const vol = row.volume;
      const commissionHalf = Math.abs(row.commission) / 2;

      if (resident) {
        // FIX Bug 2: XTB Romania — Purchase/Sale values are already in RON, commission too.
        // Use currency='RON' so FIFO applies rate=1 (no double-conversion of commission).
        const buyPriceRON = vol > 0 ? row.purchaseValue / vol : 0;
        const sellPriceRON = vol > 0 ? row.saleValue / vol : 0;

        transactions.push({
          id: uuidv4(),
          date: openDate,
          type: 'buy',
          symbol: cleanedSymbol,
          quantity: vol,
          pricePerUnit: buyPriceRON,
          totalAmount: row.purchaseValue,
          commission: commissionHalf,
          currency: 'RON',
          exchangeRate: 1,
          instrumentType,
        });

        transactions.push({
          id: uuidv4(),
          date: closeDate,
          type: 'sell',
          symbol: cleanedSymbol,
          quantity: vol,
          pricePerUnit: sellPriceRON,
          totalAmount: row.saleValue,
          commission: commissionHalf,
          currency: 'RON',
          exchangeRate: 1,
          instrumentType,
        });
      } else {
        // XTB International: prices in asset currency (USD, EUR…), use derived exchange rate
        const currency = detectCurrency(rawSymbol);

        const buyExRate = (row.openPrice > 0 && vol > 0)
          ? row.purchaseValue / (row.openPrice * vol)
          : 1;
        const sellExRate = (row.closePrice > 0 && vol > 0)
          ? row.saleValue / (row.closePrice * vol)
          : 1;

        transactions.push({
          id: uuidv4(),
          date: openDate,
          type: 'buy',
          symbol: cleanedSymbol,
          quantity: vol,
          pricePerUnit: row.openPrice,
          totalAmount: row.purchaseValue,
          commission: commissionHalf,
          currency,
          exchangeRate: buyExRate > 0.1 ? buyExRate : 1,
          instrumentType,
        });

        transactions.push({
          id: uuidv4(),
          date: closeDate,
          type: 'sell',
          symbol: cleanedSymbol,
          quantity: vol,
          pricePerUnit: row.closePrice,
          totalAmount: row.saleValue,
          commission: commissionHalf,
          currency,
          exchangeRate: sellExRate > 0.1 ? sellExRate : 1,
          instrumentType,
        });
      }
    }
  }

  // Cash operations → interest income
  for (const row of cashRows) {
    const typeLower = row.type.toLowerCase();
    if (!typeLower.includes('interest')) continue;

    const date = parseXTBDate(row.time);
    if (!date) continue;
    updatePeriod(date);

    interests.push({
      id: uuidv4(),
      date,
      grossAmount: Math.abs(row.amount),
      whtAmount: 0,
      currency: 'RON',
      source: 'cash_interest',
    });
  }

  return {
    // FIX Bug 1: return 'xtb_ro' (resident) if Romanian entity detected
    broker: resident ? 'xtb_ro' : 'xtb',
    transactions,
    dividends: [],
    interests,
    warnings,
    currency: 'RON',
    period: {
      from: minDate ?? new Date(),
      to:   maxDate ?? new Date(),
    },
  };
}

// ---------------------------------------------------------------------------
// Excel parser
// Called from useFileUpload.ts after SheetJS converts sheets to string[][]
// ---------------------------------------------------------------------------

export interface XTBSheets {
  closedPositions: string[][];  // rows from Closed Position History sheet
  cashOperations:  string[][];  // rows from Cash Operation History sheet
}

export function parseXTBExcel(sheets: XTBSheets): ParseResult {
  const closedRows: ClosedPositionRow[] = [];
  const cashRows:   CashOperationRow[]  = [];

  // Parse closed positions
  const cpRows = sheets.closedPositions;
  if (cpRows.length > 0) {
    const headers = cpRows[0].map(h => String(h).toLowerCase().trim());

    function idx(name: string): number { return headers.indexOf(name); }

    for (let i = 1; i < cpRows.length; i++) {
      const row = cpRows[i];
      const position = String(row[idx('position')] ?? '').trim();
      if (!position || position.toLowerCase() === 'total' || !/^\d+$/.test(position)) continue;

      closedRows.push({
        positionId:    position,
        symbol:        String(row[idx('symbol')]         ?? '').trim(),
        type:          String(row[idx('type')]           ?? '').trim(),
        volume:        parseNum(row[idx('volume')]),
        openTime:      String(row[idx('open time')]      ?? '').trim(),
        openPrice:     parseNum(row[idx('open price')]),
        closeTime:     String(row[idx('close time')]     ?? '').trim(),
        closePrice:    parseNum(row[idx('close price')]),
        purchaseValue: parseNum(row[idx('purchase value')]),
        saleValue:     parseNum(row[idx('sale value')]),
        commission:    parseNum(row[idx('commission')]),
        swap:          parseNum(row[idx('swap')]),
        grossPL:       parseNum(row[idx('gross p/l')]),
      });
    }
  }

  // Parse cash operations
  const coRows = sheets.cashOperations;
  if (coRows.length > 0) {
    const headers = coRows[0].map(h => String(h).toLowerCase().trim());
    function idx(name: string): number { return headers.indexOf(name); }

    for (let i = 1; i < coRows.length; i++) {
      const row = coRows[i];
      const id = String(row[0] ?? '').trim();
      if (!id || id.toLowerCase() === 'total' || !/^\d+$/.test(id)) continue;

      cashRows.push({
        type:   String(row[idx('type')]   ?? '').trim(),
        time:   String(row[idx('time')]   ?? '').trim(),
        amount: parseNum(row[idx('amount')]),
      });
    }
  }

  if (closedRows.length === 0 && cashRows.length === 0) {
    throw new Error(
      'Nu am gasit date in fisierul Excel XTB. ' +
      'Asigura-te ca exporti raportul "Closed Position History" din xStation.'
    );
  }

  // Detect XTB Romania from sheet content (fallback when cashRows has no "Romania Tax" entry)
  const rawText = sheets.closedPositions.flat().join(' ') +
                  sheets.cashOperations.flat().join(' ');
  const isRO = rawText.toLowerCase().includes('romania');

  return buildParseResult(closedRows, cashRows, isRO);
}

// ---------------------------------------------------------------------------
// PDF parser
// Called from index.ts after extractTextFromPDF produces tab-separated text
// ---------------------------------------------------------------------------

/**
 * XTB PDFs may render multi-word column headers as separate tab-separated items
 * (e.g. "Open\ttime" instead of "Open time").
 * This function merges adjacent single-word tokens back into known column names.
 */
function mergeXTBHeaders(rawCols: string[]): string[] {
  const MULTI = new Set([
    'open time', 'close time', 'open price', 'close price',
    'open origin', 'close origin', 'purchase value', 'sale value',
    'gross p/l',
  ]);
  const result: string[] = [];
  let i = 0;
  while (i < rawCols.length) {
    if (i + 1 < rawCols.length) {
      const two = rawCols[i] + ' ' + rawCols[i + 1];
      if (MULTI.has(two)) { result.push(two); i += 2; continue; }
    }
    result.push(rawCols[i]);
    i++;
  }
  return result;
}

export function parseXTBPDF(text: string): ParseResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const closedRows: ClosedPositionRow[] = [];
  const cashRows:   CashOperationRow[]  = [];

  let section: 'closed' | 'cash' | null = null;
  let closedHeaders: string[] = [];
  let cashHeaders:   string[] = [];

  for (const line of lines) {
    // Normalize tabs → spaces before section header detection.
    // PDF text extraction may render "Closed Position History" as "Closed\tPosition\tHistory"
    // if each word is a separate text item in the PDF.
    const lineNorm = line.toLowerCase().replace(/\t+/g, ' ');

    if (lineNorm.includes('closed position history')) { section = 'closed'; continue; }
    if (lineNorm.includes('open position history'))   { section = null;     continue; }
    if (lineNorm.includes('pending orders'))          { section = null;     continue; }
    if (lineNorm.includes('cash operation history'))  { section = 'cash';   continue; }

    const cols = line.split('\t').map(c => c.trim());

    if (section === 'closed') {
      const colsLower = cols.map(c => c.toLowerCase());
      if (colsLower.some(c => c === 'position') && colsLower.some(c => c === 'symbol')) {
        closedHeaders = mergeXTBHeaders(colsLower);
        continue;
      }
      if (closedHeaders.length === 0) continue;

      const getC = (name: string): string => {
        const i = closedHeaders.indexOf(name);
        return i >= 0 ? (cols[i] ?? '') : '';
      };

      const position = getC('position');
      if (!position || position === 'total' || !/^\d+$/.test(position)) continue;

      closedRows.push({
        positionId:    position,
        symbol:        getC('symbol'),
        type:          getC('type'),
        volume:        parseNum(getC('volume')),
        openTime:      getC('open time'),
        openPrice:     parseNum(getC('open price')),
        closeTime:     getC('close time'),
        closePrice:    parseNum(getC('close price')),
        purchaseValue: parseNum(getC('purchase value')),
        saleValue:     parseNum(getC('sale value')),
        commission:    parseNum(getC('commission')),
        swap:          parseNum(getC('swap')),
        grossPL:       parseNum(getC('gross p/l')),
      });
    }

    if (section === 'cash') {
      const colsLower = cols.map(c => c.toLowerCase());
      if (colsLower.some(c => c === 'id') && colsLower.some(c => c === 'amount')) {
        cashHeaders = mergeXTBHeaders(colsLower);
        continue;
      }
      if (cashHeaders.length === 0) continue;

      const getCash = (name: string): string => {
        const i = cashHeaders.indexOf(name);
        return i >= 0 ? (cols[i] ?? '') : '';
      };

      const id = cols[cashHeaders.indexOf('id')] ?? '';
      if (!id || id === 'total' || !/^\d+$/.test(id)) continue;

      cashRows.push({
        type:   getCash('type'),
        time:   getCash('time'),
        amount: parseNum(getCash('amount')),
      });
    }
  }

  if (closedRows.length === 0 && cashRows.length === 0) {
    throw new Error(
      'Nu am gasit date XTB in PDF. ' +
      'Asigura-te ca PDF-ul contine sectiunea "Closed Position History".'
    );
  }

  // Detect XTB Romania from full PDF text (account header, entity name, etc.)
  const isRO = text.toLowerCase().includes('romania');

  return buildParseResult(closedRows, cashRows, isRO);
}
