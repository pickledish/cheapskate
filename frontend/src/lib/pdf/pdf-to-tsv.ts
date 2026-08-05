import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export interface PdfToTsvOptions {
  /**
   * Snap x/y to this grid (PDF points). Same column/line share a bucket.
   * Default: 2
   */
  quantize?: number;
}

/**
 * Extract PDF text as compact TSV with quantized coordinates for LLM input.
 *
 * Output shape:
 * ```
 * # page=1 w=612 h=792
 * # cols: x y text
 * 72	720	Account ending in 4821
 * 72	640	VTI
 * ...
 * ```
 *
 * Coordinates are PDF user space (origin bottom-left, y up), quantized to integers.
 * Rows are sorted top-to-bottom, then left-to-right.
 */
export async function pdfToQuantizedTsv(
  pdfData: ArrayBuffer,
  options: PdfToTsvOptions = {},
): Promise<string> {
  const quantize = options.quantize ?? 2;

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    type Row = { x: number; y: number; text: string };
    const rows: Row[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const text = sanitizeTsvCell(item.str);
      if (!text) continue;

      const x = quantizeCoord(item.transform[4], quantize);
      const y = quantizeCoord(item.transform[5], quantize);
      rows.push({ x, y, text });
    }

    // Top-to-bottom (higher y first), then left-to-right
    rows.sort((a, b) => b.y - a.y || a.x - b.x);

    parts.push(
      `# page=${pageNumber} w=${Math.round(viewport.width)} h=${Math.round(viewport.height)}`,
    );
    parts.push('# cols: x y text');
    for (const row of rows) {
      parts.push(`${row.x}\t${row.y}\t${row.text}`);
    }

    page.cleanup();
  }

  pdf.destroy();
  return parts.join('\n');
}

function quantizeCoord(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Keep TSV rows intact: collapse whitespace, strip control chars. */
function sanitizeTsvCell(str: string): string {
  return str
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
