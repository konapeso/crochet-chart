import { type Lab, SRGB_TO_LINEAR, linearRgbToLab, nearestIndex } from "./color";

/** tapestry = 細編みの編み込み（カラー） / filet = 方眼編み（単色） */
export type Mode = "tapestry" | "filet";

/** 10cm 四方あたりの目数・段数 */
export type Gauge = { stitches: number; rows: number };

export type Rect = { x: number; y: number; w: number; h: number };

/** 1マスの実寸（cm）。方眼編みの1マスは長編み3目分の幅・1段分の高さ */
export function cellSizeCm(mode: Mode, gauge: Gauge): { w: number; h: number } {
  const stitchW = 10 / gauge.stitches;
  return { w: mode === "filet" ? stitchW * 3 : stitchW, h: 10 / gauge.rows };
}

/** 仕上がりの縦横比に合わせて画像の中央を切り抜く */
export function cropRect(imgW: number, imgH: number, cols: number, rows: number, cell: { w: number; h: number }): Rect {
  const target = (cols * cell.w) / (rows * cell.h);
  if (imgW / imgH > target) {
    const w = imgH * target;
    return { x: (imgW - w) / 2, y: 0, w, h: imgH };
  }
  const h = imgW / target;
  return { x: 0, y: (imgH - h) / 2, w: imgW, h };
}

/** 写真の縦横比をそのまま保つ段数 */
export function suggestRows(imgW: number, imgH: number, cols: number, cell: { w: number; h: number }): number {
  return Math.max(1, Math.round((cols * cell.w * imgH) / imgW / cell.h));
}

/** 各マスの平均色（リニア RGB で平均してから Lab に変換）。上の行から順に並ぶ */
export function sampleCells(pixels: ImageData, crop: Rect, cols: number, rows: number): Lab[] {
  const { data, width, height } = pixels;
  const out: Lab[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y0 = Math.min(height - 1, Math.floor(crop.y + (r * crop.h) / rows));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor(crop.y + ((r + 1) * crop.h) / rows)));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.min(width - 1, Math.floor(crop.x + (c * crop.w) / cols));
      const x1 = Math.max(x0 + 1, Math.min(width, Math.floor(crop.x + ((c + 1) * crop.w) / cols)));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          sr += SRGB_TO_LINEAR[data[i]];
          sg += SRGB_TO_LINEAR[data[i + 1]];
          sb += SRGB_TO_LINEAR[data[i + 2]];
        }
      }
      const n = (x1 - x0) * (y1 - y0);
      out[r * cols + c] = linearRgbToLab(sr / n, sg / n, sb / n);
    }
  }
  return out;
}

/** パレットへ減色。dither = true で Floyd–Steinberg（Lab 空間で誤差拡散） */
export function quantize(cells: Lab[], cols: number, rows: number, palette: Lab[], dither: boolean): Uint8Array {
  const out = new Uint8Array(cells.length);
  if (!dither) {
    for (let i = 0; i < cells.length; i++) out[i] = nearestIndex(cells[i], palette);
    return out;
  }
  const work = cells.map((c) => [c[0], c[1], c[2]] as Lab);
  const spread = (c: number, r: number, err: Lab, k: number) => {
    if (c < 0 || c >= cols || r >= rows) return;
    const w = work[r * cols + c];
    w[0] += err[0] * k;
    w[1] += err[1] * k;
    w[2] += err[2] * k;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const idx = nearestIndex(work[i], palette);
      out[i] = idx;
      const p = palette[idx];
      const err: Lab = [work[i][0] - p[0], work[i][1] - p[1], work[i][2] - p[2]];
      spread(c + 1, r, err, 7 / 16);
      spread(c - 1, r + 1, err, 3 / 16);
      spread(c, r + 1, err, 5 / 16);
      spread(c + 1, r + 1, err, 1 / 16);
    }
  }
  return out;
}

/** 明度 L* がしきい値より暗いマスを 1（埋まったマス）にする */
export function binarize(cells: Lab[], threshold: number, invert: boolean): Uint8Array {
  const out = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const dark = cells[i][0] < threshold;
    out[i] = dark !== invert ? 1 : 0;
  }
  return out;
}
