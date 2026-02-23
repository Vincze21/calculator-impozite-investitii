import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedTransaction,
  NormalizedDividend,
  NormalizedInterest,
  InstrumentType,
  ParseResult,
} from './types';

type IBKRSection = 'Trades' | 'Dividends' | 'Withholding Tax' | 'Interest';

interface SectionData {
  headers: string[];
  rows: string[][];
}

function parseIBKRDate(dateStr: string): Date {
  // Formats: "YYYY-MM-DD, HH:MM:SS" or "YYYY-MM-DD" or "YYYYMMDD"
  const clean = dateStr.trim().replace(/,\s*/, 'T');
  if (/^\d{8}$/.test(clean)) {
    return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`);
  }
  return new Date(clean);
}

function mapAssetCategory(category: string): InstrumentType {
  const cat = category.trim().toUpperCase();
  switch (cat) {
    case 'STK': return 'stock';
    case 'OPT': return 'option';
    case 'FUT': return 'future';
    case 'CFD': return 'cfd';
    case 'BOND': return 'bond_corp';
    case 'CASH': return 'stock'; // forex — will be filtered
    default: return 'stock';
  }
}

function extractSymbolFromDescription(description: string): { symbol: string; country: string } {
  // Format: "AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend)"
  const symbolMatch = description.match(/^([A-Z0-9.]+)\(/);
  const isinMatch = description.match(/\(([A-Z]{2}\w+)\)/);
  return {
    symbol: symbolMatch ? symbolMatch[1] : description.split(' ')[0],
    country: isinMatch ? isinMatch[1].substring(0, 2) : 'US',
  };
}

function parseSections(content: string): Map<string, SectionData> {
  const sections = new Map<string, SectionData>();
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // IBKR format: "SectionName,DataDiscriminator,..."
    // Header rows: "Trades,Header,..."
    // Data rows: "Trades,Data,..."
    const parts = parseCSVLine(line);
    if (parts.length < 2) continue;

    const sectionName = parts[0].trim();
    const discriminator = parts[1].trim();

    if (!['Trades', 'Dividends', 'Withholding Tax', 'Interest'].includes(sectionName)) {
      continue;
    }

    if (discriminator === 'Header') {
      sections.set(sectionName, {
        headers: parts.slice(2),
        rows: sections.get(sectionName)?.rows ?? [],
      });
    } else if (discriminator === 'Data') {
      const existing = sections.get(sectionName);
      if (existing) {
        existing.rows.push(parts.slice(2));
      } else {
        sections.set(sectionName, { headers: [], rows: [parts.slice(2)] });
      }
    }
  }

  return sections;
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
  const idx = headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
  return idx >= 0 && idx < row.length ? row[idx].trim() : '';
}

export function parseIBKR(content: string): ParseResult {
  const sections = parseSections(content);
  const transactions: NormalizedTransaction[] = [];
  const dividends: NormalizedDividend[] = [];
  const interests: NormalizedInterest[] = [];
  const warnings: string[] = [];

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let mainCurrency = 'USD';

  // Parse Trades
  const trades = sections.get('Trades');
  if (trades && trades.headers.length > 0) {
    for (const row of trades.rows) {
      try {
        const assetCategory = getCol(trades.headers, row, 'Asset Category');
        const currency = getCol(trades.headers, row, 'Currency');
        const symbol = getCol(trades.headers, row, 'Symbol');
        const dateTime = getCol(trades.headers, row, 'Date/Time') || getCol(trades.headers, row, 'DateTime');
        const quantity = parseFloat(getCol(trades.headers, row, 'Quantity'));
        const tPrice = parseFloat(getCol(trades.headers, row, 'T. Price'));
        const proceeds = parseFloat(getCol(trades.headers, row, 'Proceeds'));
        const commFee = parseFloat(getCol(trades.headers, row, 'Comm/Fee'));
        const code = getCol(trades.headers, row, 'Code');

        // Skip forex conversions, corporate actions marked with specific codes
        if (assetCategory === 'Forex' || assetCategory === 'CASH') continue;
        if (code && (code.includes('A') || code.includes('Ca'))) {
          warnings.push(`${symbol}: actiune corporativa detectata (cod: ${code}) — verificati manual`);
          continue;
        }

        if (isNaN(quantity) || quantity === 0) continue;

        const date = parseIBKRDate(dateTime);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;

        transactions.push({
          id: uuidv4(),
          date,
          type: quantity > 0 ? 'buy' : 'sell',
          symbol,
          quantity: Math.abs(quantity),
          pricePerUnit: tPrice,
          totalAmount: Math.abs(proceeds),
          commission: Math.abs(commFee),
          currency,
          instrumentType: mapAssetCategory(assetCategory),
        });

        if (currency !== 'RON') mainCurrency = currency;
      } catch (err) {
        warnings.push(`Rand tranzactie neparsabil: ${row.join(',').substring(0, 80)}...`);
      }
    }
  }

  // Parse Dividends
  const divSection = sections.get('Dividends');
  const whtSection = sections.get('Withholding Tax');

  // Build WHT lookup: key = "SYMBOL_DATE" -> amount
  const whtMap = new Map<string, number>();
  if (whtSection && whtSection.headers.length > 0) {
    for (const row of whtSection.rows) {
      try {
        const description = getCol(whtSection.headers, row, 'Description');
        const amount = parseFloat(getCol(whtSection.headers, row, 'Amount'));
        const dateStr = getCol(whtSection.headers, row, 'Date');
        const { symbol } = extractSymbolFromDescription(description);
        const key = `${symbol}_${dateStr}`;
        whtMap.set(key, Math.abs(amount));
      } catch {
        // ignore unparseable WHT rows
      }
    }
  }

  if (divSection && divSection.headers.length > 0) {
    for (const row of divSection.rows) {
      try {
        const currency = getCol(divSection.headers, row, 'Currency');
        const dateStr = getCol(divSection.headers, row, 'Date');
        const description = getCol(divSection.headers, row, 'Description');
        const amount = parseFloat(getCol(divSection.headers, row, 'Amount'));

        if (isNaN(amount) || amount === 0) continue;

        const { symbol, country } = extractSymbolFromDescription(description);
        const date = parseIBKRDate(dateStr);

        // Find matching WHT
        const whtKey = `${symbol}_${dateStr}`;
        const whtAmount = whtMap.get(whtKey) ?? 0;

        dividends.push({
          id: uuidv4(),
          date,
          symbol,
          grossAmount: Math.abs(amount),
          whtAmount,
          netAmount: Math.abs(amount) - whtAmount,
          currency,
          country,
        });

        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      } catch {
        warnings.push(`Rand dividend neparsabil: ${row.join(',').substring(0, 80)}...`);
      }
    }
  }

  // Parse Interest
  const interestSection = sections.get('Interest');
  if (interestSection && interestSection.headers.length > 0) {
    for (const row of interestSection.rows) {
      try {
        const currency = getCol(interestSection.headers, row, 'Currency');
        const dateStr = getCol(interestSection.headers, row, 'Date');
        const amount = parseFloat(getCol(interestSection.headers, row, 'Amount'));

        if (isNaN(amount) || amount === 0) continue;

        interests.push({
          id: uuidv4(),
          date: parseIBKRDate(dateStr),
          grossAmount: Math.abs(amount),
          whtAmount: 0,
          currency,
          source: 'cash_interest',
        });
      } catch {
        // ignore unparseable interest rows
      }
    }
  }

  return {
    broker: 'ibkr',
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
