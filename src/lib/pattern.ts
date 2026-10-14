import { type Lab, SRGB_TO_LINEAR, linearRgbToLab, nearestIndex } from "./color";
import type { LineInfo } from "./lineart";

/** tapestry = 細編みの編み込み（カラー） / filet = 方眼編み（単色） */
export type Mode = "tapestry" | "filet";

/** 10cm 四方あたりの目数・段数 */
export type Gauge = { stitches: number; rows: number };

export type Rect = { x: number; y: number; w: number; h: number };

/** 切り抜き範囲の指定。zoom = 1 で入るだけ大きく、center は画像に対する割合（0〜1） */
export type CropView = { zoom: number; cx: number; cy: number };

export const DEFAULT_VIEW: CropView = { zoom: 1, cx: 0.5, cy: 0.5 };

/** 1マスの実寸（cm）。方眼編みの1マスは長編み3目分の幅・1段分の高さ */
export function cellSizeCm(mode: Mode, gauge: Gauge): { w: number; h: number } {
  const stitchW = 10 / gauge.stitches;
  return { w: mode === "filet" ? stitchW * 3 : stitchW, h: 10 / gauge.rows };
}

/** 画像からはみ出さないよう切り抜き範囲を動かす */
export function clampRect(r: Rect, imgW: number, imgH: number): Rect {
  return { ...r, x: Math.min(Math.max(0, r.x), imgW - r.w), y: Math.min(Math.max(0, r.y), imgH - r.h) };
}

/** 仕上がりの縦横比で画像を切り抜く（view で拡大・位置を指定） */
export function cropRect(imgW: number, imgH: number, cols: number, rows: number, cell: { w: number; h: number }, view: CropView = DEFAULT_VIEW): Rect {
  const target = (cols * cell.w) / (rows * cell.h);
  let w = imgW;
  let h = imgH;
  if (imgW / imgH > target) w = imgH * target;
  else h = imgW / target;
  w /= view.zoom;
  h /= view.zoom;
  return clampRect({ x: view.cx * imgW - w / 2, y: view.cy * imgH - h / 2, w, h }, imgW, imgH);
}

/** 写真の縦横比をそのまま保つ段数 */
export function suggestRows(imgW: number, imgH: number, cols: number, cell: { w: number; h: number }): number {
  return Math.max(1, Math.round((cols * cell.w * imgH) / imgW / cell.h));
}

export type Sampled = {
  /** 各マスの色（上の行から順）。線の検出をしたときは線以外のピクセルの平均 */
  labs: Lab[];
  /** 各マスで線のピクセルが占める割合（線の検出をしないときは null） */
  lineCoverage: Float32Array | null;
  /** 各マスを通る線の中心線の長さ（マスの一辺を 1 とする）。短すぎる線は数えない */
  lineLength: Float32Array | null;
};

/** これより短い線（マスの一辺に対する倍率）は無視する（ほっぺの斜線など） */
const MIN_STROKE = 1.2;

/**
 * 各マスの平均色（リニア RGB で平均してから Lab に変換）。
 * lines を渡すと、線のピクセルを除いて平均し、線の割合と中心線の長さも数える。
 */
export function sampleCells(pixels: ImageData, crop: Rect, cols: number, rows: number, lines: LineInfo | null = null): Sampled {
  const { data, width, height } = pixels;
  const labs: Lab[] = new Array(cols * rows);
  const lineMask = lines?.mask;
  const coverage = lines ? new Float32Array(cols * rows) : null;
  const length = lines ? new Float32Array(cols * rows) : null;
  const side = Math.sqrt((crop.w / cols) * (crop.h / rows));
  const minStroke = side * MIN_STROKE;
  for (let r = 0; r < rows; r++) {
    const y0 = Math.min(height - 1, Math.floor(crop.y + (r * crop.h) / rows));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor(crop.y + ((r + 1) * crop.h) / rows)));
    for (let c = 0; c < cols; c++) {
      const x0 = Math.min(width - 1, Math.floor(crop.x + (c * crop.w) / cols));
      const x1 = Math.max(x0 + 1, Math.min(width, Math.floor(crop.x + ((c + 1) * crop.w) / cols)));
      // [全体, 線以外] の合計
      let ar = 0, ag = 0, ab = 0, fr = 0, fg = 0, fb = 0, lineCount = 0, skel = 0;
      for (let y = y0; y < y1; y++) {
        let p = y * width + x0;
        for (let x = x0; x < x1; x++, p++) {
          const i = p * 4;
          const lr = SRGB_TO_LINEAR[data[i]];
          const lg = SRGB_TO_LINEAR[data[i + 1]];
          const lb = SRGB_TO_LINEAR[data[i + 2]];
          ar += lr;
          ag += lg;
          ab += lb;
          if (lines && lines.skeleton[p] && lines.lengths[p] >= minStroke) skel++;
          if (lineMask && lineMask[p]) {
            lineCount++;
          } else {
            fr += lr;
            fg += lg;
            fb += lb;
          }
        }
      }
      const n = (x1 - x0) * (y1 - y0);
      const idx = r * cols + c;
      const fill = n - lineCount;
      labs[idx] = fill > 0 && coverage ? linearRgbToLab(fr / fill, fg / fill, fb / fill) : linearRgbToLab(ar / n, ag / n, ab / n);
      if (coverage) coverage[idx] = lineCount / n;
      if (length) length[idx] = skel / side;
    }
  }
  return { labs, lineCoverage: coverage, lineLength: length };
}

/** マスの大半が線の色（目の黒など塗りつぶし）なら線の色にする */
const SOLID_COVERAGE = 0.55;

/**
 * 線の色にするマス。線の中心線がマスをある程度の長さ通るか、マスの大半が線の色で塗られていれば線。
 * 中心線で判定するので、線がマスの境目にかかっても2マスの太さにならない。
 */
export function lineCells(coverage: Float32Array, length: Float32Array, minLength: number): Uint8Array {
  const out = new Uint8Array(coverage.length);
  for (let i = 0; i < coverage.length; i++) out[i] = coverage[i] >= SOLID_COVERAGE || length[i] >= minLength ? 1 : 0;
  return out;
}

/**
 * 淡い色の色みを強める（色鉛筆の淡い塗りを毛糸の色に合わせやすくする）。
 * 彩度を最大 1.5 倍、ただし増やすのは maxGain まで（もともと色のある部分が派手になりすぎないように）
 */
export function boostChroma(cells: Lab[], maxGain = 8): Lab[] {
  return cells.map(([L, a, b]) => {
    const c = Math.hypot(a, b);
    if (c === 0) return [L, a, b];
    const k = (c + Math.min(c * 0.5, maxGain)) / c;
    return [L, a * k, b * k];
  });
}

/** これより色みの弱いマス（白・淡いほっぺなど）はならさない */
const SMOOTH_MIN_CHROMA = 18;

/**
 * 色のはっきりした塗り（彩度 SMOOTH_MIN_CHROMA 以上）の中で、色の近いマス同士だけを平均して塗りムラをならす。
 * 輪郭はぼかさない。fixed で 1 のマス（線）と、白や淡い色のマスはそのまま。
 */
export function smoothCells(cells: Lab[], cols: number, rows: number, fixed: Uint8Array | null, iterations = 3, maxDiff = 10): Lab[] {
  let cur = cells;
  for (let it = 0; it < iterations; it++) {
    const next: Lab[] = new Array(cur.length);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const [L, a, b] = cur[i];
        const skip = (k: number) => fixed?.[k] || Math.hypot(cur[k][1], cur[k][2]) < SMOOTH_MIN_CHROMA;
        if (skip(i)) {
          next[i] = cur[i];
          continue;
        }
        let sL = 0, sa = 0, sb = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const y = r + dy;
            const x = c + dx;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const j = y * cols + x;
            if (skip(j)) continue;
            const q = cur[j];
            if (Math.hypot(q[0] - L, q[1] - a, q[2] - b) > maxDiff) continue;
            sL += q[0];
            sa += q[1];
            sb += q[2];
            n++;
          }
        }
        next[i] = [sL / n, sa / n, sb / n];
      }
    }
    cur = next;
  }
  return cur;
}

/**
 * パレットへ減色。dither = true で Floyd–Steinberg（Lab 空間で誤差拡散）。
 * fixed で 1 のマスは fixedIndex（線の色）にし、誤差拡散の対象から外す。
 * kL は CIEDE2000 の明るさの重み（2 で明るさの差を半分に評価する）。
 */
export function quantize(
  cells: Lab[],
  cols: number,
  rows: number,
  palette: Lab[],
  dither: boolean,
  fixed: Uint8Array | null = null,
  fixedIndex = 0,
  kL = 1,
): Uint8Array {
  const out = new Uint8Array(cells.length);
  if (!dither) {
    for (let i = 0; i < cells.length; i++) out[i] = fixed?.[i] ? fixedIndex : nearestIndex(cells[i], palette, kL);
    return out;
  }
  const work = cells.map((c) => [c[0], c[1], c[2]] as Lab);
  const spread = (c: number, r: number, err: Lab, k: number) => {
    if (c < 0 || c >= cols || r >= rows) return;
    const i = r * cols + c;
    if (fixed?.[i]) return;
    const w = work[i];
    w[0] += err[0] * k;
    w[1] += err[1] * k;
    w[2] += err[2] * k;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (fixed?.[i]) {
        out[i] = fixedIndex;
        continue;
      }
      const idx = nearestIndex(work[i], palette, kL);
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

/** 明度 L* がしきい値より暗いマスを 1（埋まったマス）にする。forced で 1 のマス（線）は必ず埋める */
export function binarize(cells: Lab[], threshold: number, invert: boolean, forced: Uint8Array | null = null): Uint8Array {
  const out = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const dark = cells[i][0] < threshold;
    out[i] = forced?.[i] || dark !== invert ? 1 : 0;
  }
  return out;
}
