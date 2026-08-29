/**
 * Trim letterbox / pad pixels from a buyer creative so the paid slot follows
 * the real artwork instead of empty black (or transparent) margins.
 */

export type Bounds = { x: number; y: number; w: number; h: number };

const ALPHA_MIN = 16;
/** Max channel distance from the corner background to still count as empty. */
const BG_DELTA = 28;
/** Ignore crops that only shave a couple of pixels. */
const MIN_TRIM_RATIO = 0.02;

function colorDist(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number,
) {
  return Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
}

/**
 * Bounding box of non-background pixels in an ImageData buffer. Returns null
 * when the frame is empty or almost empty so callers keep the original file.
 */
export function contentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Bounds | null {
  if (width < 2 || height < 2) return null;

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const;
  };

  const corners = [
    sample(0, 0),
    sample(width - 1, 0),
    sample(0, height - 1),
    sample(width - 1, height - 1),
  ];
  const br = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
  const bg = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
  const bb = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);
  const ba = Math.round(corners.reduce((s, c) => s + c[3], 0) / 4);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Transparent (or near-transparent) corner background: keep opaque ink.
      if (ba < ALPHA_MIN) {
        if (a < ALPHA_MIN) continue;
      } else if (a < ALPHA_MIN || colorDist(r, g, b, br, bg, bb) <= BG_DELTA) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const pad = Math.max(2, Math.round(Math.max(width, height) * 0.02));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(width - x, maxX - minX + 1 + pad * 2);
  const h = Math.min(height - y, maxY - minY + 1 + pad * 2);

  const trimmed = 1 - (w * h) / (width * height);
  if (trimmed < MIN_TRIM_RATIO) return null;

  return { x, y, w, h };
}

export type TrimmedCreative = {
  file: File;
  objectUrl: string;
  aspect: number;
  trimmed: boolean;
};

/**
 * Browser-side trim. Falls back to the original file when there is nothing
 * useful to crop (solid frames, already-tight logos).
 */
export async function trimCreativeFile(file: File): Promise<TrimmedCreative> {
  const originalUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(originalUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      return {
        file,
        objectUrl: originalUrl,
        aspect: width && height ? width / height : 1,
        trimmed: false,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { file, objectUrl: originalUrl, aspect: width / height, trimmed: false };
    }

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const bounds = contentBounds(imageData.data, width, height);

    if (!bounds) {
      return { file, objectUrl: originalUrl, aspect: width / height, trimmed: false };
    }

    const out = document.createElement("canvas");
    out.width = bounds.w;
    out.height = bounds.h;
    const outCtx = out.getContext("2d");
    if (!outCtx) {
      return { file, objectUrl: originalUrl, aspect: width / height, trimmed: false };
    }
    outCtx.drawImage(
      canvas,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      0,
      0,
      bounds.w,
      bounds.h,
    );

    const mime =
      file.type === "image/png" || file.type === "image/webp" || file.type === "image/jpeg"
        ? file.type
        : "image/png";
    const blob = await canvasToBlob(out, mime);
    const base = file.name.replace(/\.[^.]+$/, "") || "creative";
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    const trimmedFile = new File([blob], `${base}-trim.${ext}`, { type: mime });
    URL.revokeObjectURL(originalUrl);
    return {
      file: trimmedFile,
      objectUrl: URL.createObjectURL(trimmedFile),
      aspect: bounds.w / bounds.h,
      trimmed: true,
    };
  } catch {
    return {
      file,
      objectUrl: originalUrl,
      aspect: 1,
      trimmed: false,
    };
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode creative"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode creative"))),
      mime,
      mime === "image/jpeg" ? 0.92 : undefined,
    );
  });
}
