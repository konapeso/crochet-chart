export type SourceImage = {
  /** 縮小済みの画像（プレビュー描画用） */
  canvas: HTMLCanvasElement;
  /** canvas と同じ内容のピクセル（RGBA） */
  pixels: ImageData;
  width: number;
  height: number;
};

/** iOS Safari の canvas メモリ制限に収まるよう、長辺をこの値以下に縮小する */
export const MAX_SIDE = 1200;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 古い Safari などはフォールバック（<img> は EXIF の向きを自動で反映する）
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("画像を読み込めませんでした");
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

export async function loadImageFile(file: File): Promise<SourceImage> {
  const { source, width, height, close } = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas を作成できませんでした");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    return { canvas, pixels: ctx.getImageData(0, 0, w, h), width: w, height: h };
  } finally {
    close();
  }
}
