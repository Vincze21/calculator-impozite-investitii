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

      let text: string;

      if (file.name.toLowerCase().endsWith('.pdf')) {
        // PDF file: extract text using pdfjs-dist (with OCR fallback for image PDFs)
        setProgress('Se incarca PDF-ul...');
        const { extractTextFromPDF } = await import('@/lib/pdf/extract-text');
        const arrayBuffer = await file.arrayBuffer();
        text = await extractTextFromPDF(arrayBuffer, setProgress);

        if (!text.trim()) {
          throw new Error(
            'Nu am putut extrage text din PDF. ' +
            'Fisierul poate fi protejat sau intr-un format nesuportat. ' +
            'Incearca sa exporti raportul ca CSV din platforma brokerului.'
          );
        }
        console.log('[PDF] Text extras:', text.substring(0, 1000));
        setProgress('Se parseaza datele...');
      } else {
        // CSV/TXT file: read as text directly
        text = await file.text();
      }

      const parsed = parseCSV(text, file.name);
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
