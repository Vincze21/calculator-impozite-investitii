'use client';

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source via CDN matching the installed version
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Groups text items by Y coordinate (same visual row) with tolerance,
 * then sorts each row by X coordinate (left to right).
 * Returns array of lines as tab-separated strings.
 */
function reconstructLines(items: PositionedText[]): string[] {
  if (items.length === 0) return [];

  const Y_TOLERANCE = 3;
  const sorted = [...items].sort((a, b) => b.y - a.y);

  const lines: { y: number; items: PositionedText[] }[] = [];

  for (const item of sorted) {
    const existing = lines.find(l => Math.abs(l.y - item.y) < Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  return lines.map(line => {
    line.items.sort((a, b) => a.x - b.x);
    return line.items.map(i => i.text).join('\t');
  });
}

/**
 * Preprocesses a canvas for better OCR: converts to grayscale and
 * applies binarization (pure black/white) to remove anti-aliasing,
 * gradients, and background colors that confuse Tesseract.
 */
function preprocessForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const bw = gray < 140 ? 0 : 255;
    data[i] = bw;
    data[i + 1] = bw;
    data[i + 2] = bw;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Renders a PDF page to a canvas, applies preprocessing, and returns the image data URL.
 * Used for image-based PDFs that need OCR.
 */
async function renderPageToImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = 3
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  // pdfjs-dist v5 requires canvas in RenderParameters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

  // Preprocess: binarize for better OCR accuracy
  preprocessForOCR(canvas);

  return canvas.toDataURL('image/png');
}

/**
 * Extracts text content from a PDF file.
 *
 * Strategy:
 * 1. Try pdfjs-dist text extraction (works for PDFs with embedded text)
 * 2. If no text found (image-based PDF), render pages to canvas and use Tesseract.js OCR
 */
export async function extractTextFromPDF(
  source: ArrayBuffer,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Se incarca PDF-ul...');
  const pdf = await pdfjsLib.getDocument({ data: source }).promise;
  const pages: string[] = [];

  // Step 1: Try text extraction
  let totalTextItems = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const positioned: PositionedText[] = [];
    for (const item of content.items) {
      if ('str' in item && typeof item.str === 'string' && item.str.trim()) {
        const transform = (item as { transform: number[] }).transform;
        positioned.push({
          text: item.str,
          x: transform[4],
          y: transform[5],
          width: (item as { width: number }).width,
        });
      }
    }

    totalTextItems += positioned.length;
    const lines = reconstructLines(positioned);
    pages.push(lines.join('\n'));
  }

  const textResult = pages.join('\n').trim();

  // If we got meaningful text, return it
  if (totalTextItems > 10 && textResult.length > 50) {
    return textResult;
  }

  // Step 2: PDF is image-based — use OCR
  onProgress?.('PDF-ul contine imagini. Se pregateste OCR...');

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ron+eng');

  try {
    const ocrPages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(`OCR pagina ${i}/${pdf.numPages}...`);
      const imageDataUrl = await renderPageToImage(pdf, i, 3);
      const { data: { text } } = await worker.recognize(imageDataUrl);
      ocrPages.push(text);
    }

    return ocrPages.join('\n');
  } finally {
    await worker.terminate();
  }
}
