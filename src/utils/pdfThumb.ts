import * as pdfjsLib from 'pdfjs-dist';
// Worker bundle for pdf.js; Vite will serve this URL.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function renderPdfFirstPageThumb(file: File, maxEdge = 800): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxEdge / Math.max(viewport.width, viewport.height);
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  canvas.width = scaled.width;
  canvas.height = scaled.height;

  await page.render({ canvasContext: ctx, viewport: scaled }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas'))),
      'image/jpeg',
      0.78
    );
  });
}

