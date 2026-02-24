'use client';

import { useState, useCallback } from 'react';
import type { ParseResult } from '@/types/transaction';

export function useFileUpload() {
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      const { parseCSV } = await import('@/lib/parsers');
      const nameLower = file.name.toLowerCase();
      let parsed: ParseResult;

      if (nameLower.endsWith('.pdf')) {
        // PDF: extract text, then auto-detect broker and parse
        setProgress('Se incarca PDF-ul...');
        const { extractTextFromPDF } = await import('@/lib/pdf/extract-text');
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractTextFromPDF(arrayBuffer, setProgress);

        if (!text.trim()) {
          throw new Error(
            'Nu am putut extrage text din PDF. ' +
            'Fisierul poate fi protejat sau intr-un format nesuportat. ' +
            'Incearca sa exporti raportul ca CSV din platforma brokerului.'
          );
        }
        console.log('[PDF] Text extras:', text.substring(0, 1000));
        setProgress('Se parseaza datele...');
        parsed = parseCSV(text, file.name);

      } else if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
        // Excel: XTB format — use SheetJS to extract rows, then XTB parser
        setProgress('Se incarca fisierul Excel...');
        const [xlsxLib, { parseXTBExcel }] = await Promise.all([
          import('xlsx'),
          import('@/lib/parsers/xtb'),
        ]);
        const { read, utils } = xlsxLib;
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(new Uint8Array(arrayBuffer), {
          type: 'array', cellDates: false, raw: false,
        });

        // Convert each sheet to string[][] rows
        const sheetData = (workbook.SheetNames as string[]).map((name: string) => ({
          name,
          rows: utils.sheet_to_json(workbook.Sheets[name], {
            header: 1, defval: '', raw: false,
          }) as string[][],
        }));

        // Identify Closed Positions and Cash Operations sheets by header content
        let closedPositions: string[][] = [];
        let cashOperations: string[][] = [];

        for (const { rows } of sheetData) {
          // Closed Positions: has "Position" + "Open time" + "Close time" columns
          // (Open Positions sheet also has "Position"+"Open time" but NOT "Close time")
          const norm = (c: unknown) => String(c).toLowerCase().replace(/\s+/g, ' ').trim();
          const cpIdx = rows.findIndex((r: string[]) =>
            r.some(c => norm(c) === 'position') &&
            r.some(c => norm(c) === 'open time') &&
            r.some(c => norm(c) === 'close time')
          );
          if (cpIdx >= 0) {
            closedPositions = rows.slice(cpIdx);
            continue;
          }

          // Cash Operations: has "ID" + "Amount" + "Time" columns (but NOT "Open time")
          const coIdx = rows.findIndex((r: string[]) =>
            r.some(c => norm(c) === 'id') &&
            r.some(c => norm(c) === 'amount') &&
            r.some(c => norm(c) === 'time')
          );
          if (coIdx >= 0) {
            cashOperations = rows.slice(coIdx);
          }
        }

        setProgress('Se parseaza datele...');
        parsed = parseXTBExcel({ closedPositions, cashOperations });

      } else {
        // CSV / TXT: read as text and auto-detect broker
        const text = await file.text();
        parsed = parseCSV(text, file.name);
      }

      setResult(parsed);
      setProgress(null);
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Eroare la parsarea fisierului';
      setError(message);
      setProgress(null);
      return null;
    } finally {
      setParsing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setParsing(false);
    setProgress(null);
  }, []);

  return { parsing, progress, error, result, parseFile, reset };
}
