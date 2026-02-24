import type { ParseResult } from './types';
import { detectBroker } from './detect';
import { parseIBKR } from './ibkr';
import { parseTradeVille } from './tradeville';
import { parseAvaTrade } from './avatrade';
import { parseTrading212 } from './trading212';
import { parseRevolut } from './revolut';
import { parseXTBPDF } from './xtb';

/**
 * Main entry: detecteaza broker-ul si parseaza fisierul (CSV sau text extras din PDF).
 * Arunca eroare daca broker-ul nu e recunoscut.
 */
export function parseCSV(content: string, _filename?: string): ParseResult {
  const broker = detectBroker(content);

  if (!broker) {
    throw new Error(
      'Nu am putut detecta broker-ul din fisier. ' +
      'Formatul nu e recunoscut. Incearca sa selectezi broker-ul manual.'
    );
  }

  switch (broker) {
    case 'ibkr':
      return parseIBKR(content);
    case 'tradeville':
      return parseTradeVille(content);
    case 'avatrade':
      return parseAvaTrade(content);
    case 'trading212':
      return parseTrading212(content);
    case 'revolut':
      return parseRevolut(content);
    case 'xtb':
      return parseXTBPDF(content);
    default:
      throw new Error(`Broker necunoscut: ${broker}`);
  }
}

export { detectBroker } from './detect';
export { parseIBKR } from './ibkr';
export { parseTradeVille } from './tradeville';
export { parseAvaTrade } from './avatrade';
export { parseTrading212 } from './trading212';
export { parseRevolut } from './revolut';
export { parseXTBPDF, parseXTBExcel } from './xtb';
export type { XTBSheets } from './xtb';
