import type { BrokerName } from './types';

/**
 * Auto-detectare broker din primele randuri ale fisierului (CSV sau text extras din PDF).
 * Returneaza null daca nu recunoaste — utilizatorul va selecta manual.
 */
export function detectBroker(content: string): BrokerName | null {
  // Use more lines for PDF content which has more header lines
  const lines = content.split('\n').slice(0, 30).join('\n').toLowerCase();

  // IBKR: multi-section format with "Statement" markers or "ClientAccountID"
  if (
    lines.includes('clientaccountid') ||
    lines.includes('trades,header') ||
    lines.includes('statement,header')
  ) {
    return 'ibkr';
  }

  // Trading 212: "Action,Time,ISIN,Ticker,Name,No. of shares"
  if (
    lines.includes('action') &&
    lines.includes('ticker') &&
    lines.includes('no. of shares')
  ) {
    return 'trading212';
  }

  // Revolut CSV: "Price per share" + "FX Rate"
  if (lines.includes('price per share') && lines.includes('fx rate')) {
    return 'revolut';
  }

  // Revolut PDF Statement: "Revolut" may only appear in footer (logo is an image)
  // Check first 20 lines for "account statement" + column headers unique to Revolut PDF
  if (lines.includes('account statement') && lines.includes('side') && lines.includes('fees')) {
    return 'revolut';
  }

  // Revolut PDF: broader search — "Revolut Securities" appears in footer of every page
  {
    const fullText = content.toLowerCase();
    if (fullText.includes('revolut securities') && fullText.includes('account statement')) {
      return 'revolut';
    }
  }

  // AvaTrade/MT5: "Position ID" + "Open Price" + "Profit Points"
  // Must check BEFORE XTB since both have "Open Price" + "Close Price" + "Symbol"
  if (
    lines.includes('position id') &&
    lines.includes('open price') &&
    lines.includes('profit points')
  ) {
    return 'avatrade';
  }

  // XTB PDF: "Closed Position History" + "xStation" marker
  {
    const fullText = content.toLowerCase();
    if (
      fullText.includes('closed position history') &&
      (fullText.includes('xstation') || fullText.includes('xtb'))
    ) {
      return 'xtb';
    }
  }

  // XTB CSV (xStation export): "Open price" + "Close price" + "Symbol"
  if (
    lines.includes('open price') &&
    lines.includes('close price') &&
    lines.includes('symbol')
  ) {
    return 'xtb';
  }

  // TradeVille PDF: "Activitate BVB" or "TradeVille" + "Perioada:" or table headers
  if (
    (lines.includes('activitate bvb') || lines.includes('tradeville')) &&
    (lines.includes('perioada') || (lines.includes('oper') && lines.includes('ticker')))
  ) {
    return 'tradeville';
  }

  // TradeVille CSV: "Simbol" + ("Piata" or "Cantitate")
  if (lines.includes('simbol') && (lines.includes('piata') || lines.includes('cantitate'))) {
    return 'tradeville';
  }

  return null;
}
