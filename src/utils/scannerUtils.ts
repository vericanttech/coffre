/**
 * Document image processing for PDF composer.
 * Manual crop extraction + contrast/brightness boost via Canvas API.
 */

export interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CONTRAST_BRIGHTNESS = 1.2;
const JPEG_QUALITY = 0.92;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Apply contrast/brightness boost by multiplying RGB by factor and clamping to 255.
 */
function applyContrastBrightness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  factor: number = CONTRAST_BRIGHTNESS
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.round(data[i] * factor));
    data[i + 1] = Math.min(255, Math.round(data[i + 1] * factor));
    data[i + 2] = Math.min(255, Math.round(data[i + 2] * factor));
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Extract cropped area from a rotated image, apply contrast/brightness, return JPEG data URL.
 * rotation is in degrees (0, 90, 180, 270). croppedAreaPixels is in the rotated image coordinate system (as returned by react-easy-crop).
 */
export async function applyCropAndEnhance(
  imageUrl: string,
  croppedAreaPixels: CroppedAreaPixels,
  rotation: number
): Promise<{ dataUrl: string }> {
  const img = await loadImage(imageUrl);
  const { x, y, width: cropW, height: cropH } = croppedAreaPixels;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotatedW = Math.round(srcW * cos + srcH * sin);
  const rotatedH = Math.round(srcW * sin + srcH * cos);

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = rotatedW;
  fullCanvas.height = rotatedH;
  const ctx = fullCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');

  ctx.translate(rotatedW / 2, rotatedH / 2);
  ctx.rotate(rad);
  ctx.translate(-srcW / 2, -srcH / 2);
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas 2d not available');
  outCtx.drawImage(fullCanvas, x, y, cropW, cropH, 0, 0, cropW, cropH);
  applyContrastBrightness(outCtx, cropW, cropH);

  return {
    dataUrl: outCanvas.toDataURL('image/jpeg', JPEG_QUALITY),
  };
}
