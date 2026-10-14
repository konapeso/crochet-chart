/**
 * 紙に描いたイラスト・線画の写真向けの前処理。
 * - flattenPaper: 紙の影・色かぶりを取って、紙を白にする（塗った部分の色は残す）
 * - detectLines: 暗い線（ペン）の画素を見つける
 * - thinLines: 線を中心線（1px）まで細くする
 */

const BLOCK = 16;
/** 紙とみなす画素の彩度の上限（塗った部分を紙と間違えないように） */
const PAPER_MAX_SATURATION = 0.18;

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const saturation = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/**
 * 紙の色を推定して割り算し、影と色かぶりを消す。
 * 「明るくて色みの少ない画素」だけを紙とみなし、16px ブロックごとに一番明るいものを紙の色にする。
 * 紙が見えないブロック（大きく塗った部分・目など）は周りの紙の色で埋めるので、塗った色は白くならない。
 */
export function flattenPaper(src: ImageData): ImageData {
  const { width: w, height: h, data } = src;

  // 画像全体の紙の明るさ（色みの少ない画素の明るさの上位5%）
  const hist = new Uint32Array(256);
  let lowSat = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (saturation(data[i], data[i + 1], data[i + 2]) < PAPER_MAX_SATURATION) {
      hist[Math.round(luma(data[i], data[i + 1], data[i + 2]))]++;
      lowSat++;
    }
  }
  if (lowSat === 0) return src;
  let paperL = 255;
  for (let acc = 0; paperL > 0; paperL--) {
    acc += hist[paperL];
    if (acc >= lowSat * 0.05) break;
  }
  const minPaperL = paperL * 0.7;

  // ブロックごとの紙の色（紙らしい画素のうち一番明るいもの）。見つからなければ空き
  const gw = Math.ceil(w / BLOCK);
  const gh = Math.ceil(h / BLOCK);
  const n = gw * gh;
  let bg = new Float32Array(n * 3);
  const bgL = new Float32Array(n).fill(-1);
  for (let y = 0; y < h; y++) {
    const gy = Math.floor(y / BLOCK);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = luma(r, g, b);
      if (l < minPaperL || saturation(r, g, b) >= PAPER_MAX_SATURATION) continue;
      const k = gy * gw + Math.floor(x / BLOCK);
      if (l > bgL[k]) {
        bgL[k] = l;
        bg[k * 3] = r;
        bg[k * 3 + 1] = g;
        bg[k * 3 + 2] = b;
      }
    }
  }

  // 空きブロックを、紙の色が分かっている隣のブロックの平均で少しずつ埋める
  const known = new Uint8Array(n);
  let remaining = 0;
  for (let k = 0; k < n; k++) {
    known[k] = bgL[k] >= 0 ? 1 : 0;
    if (!known[k]) remaining++;
  }
  while (remaining > 0) {
    const fill: [number, number, number, number][] = [];
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const k = gy * gw + gx;
        if (known[k]) continue;
        let s0 = 0, s1 = 0, s2 = 0, cnt = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || y < 0 || x >= gw || y >= gh || !known[y * gw + x]) continue;
          const j = (y * gw + x) * 3;
          s0 += bg[j];
          s1 += bg[j + 1];
          s2 += bg[j + 2];
          cnt++;
        }
        if (cnt) fill.push([k, s0 / cnt, s1 / cnt, s2 / cnt]);
      }
    }
    if (fill.length === 0) break;
    for (const [k, r, g, b] of fill) {
      bg[k * 3] = r;
      bg[k * 3 + 1] = g;
      bg[k * 3 + 2] = b;
      known[k] = 1;
      remaining--;
    }
  }

  // ブロックの境目が出ないよう、ぼかしてなめらかにする
  const radius = 2;
  for (const horizontal of [true, false]) {
    const nb = new Float32Array(n * 3);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let s0 = 0, s1 = 0, s2 = 0, cnt = 0;
        for (let d = -radius; d <= radius; d++) {
          const x = horizontal ? gx + d : gx;
          const y = horizontal ? gy : gy + d;
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          const j = (y * gw + x) * 3;
          s0 += bg[j];
          s1 += bg[j + 1];
          s2 += bg[j + 2];
          cnt++;
        }
        const o = (gy * gw + gx) * 3;
        nb[o] = s0 / cnt;
        nb[o + 1] = s1 / cnt;
        nb[o + 2] = s2 / cnt;
      }
    }
    bg = nb;
  }

  // 画素ごとにブロック中心の値を双線形補間して割る
  const out = new ImageData(w, h);
  const od = out.data;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / BLOCK - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / BLOCK - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const a = bg[(y0 * gw + x0) * 3 + ch];
        const b = bg[(y0 * gw + x1) * 3 + ch];
        const c = bg[(y1 * gw + x0) * 3 + ch];
        const d = bg[(y1 * gw + x1) * 3 + ch];
        const paper = Math.max(40, (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
        od[i + ch] = Math.min(255, (data[i + ch] * 255) / paper);
      }
      od[i + 3] = 255;
    }
  }
  return out;
}

/** これより暗ければ色に関係なく線 */
const DARK = 0.35 * 255;
/** 紙（255）よりこれだけ暗く、色みが少なければ線（鉛筆やぼけたペン線） */
const GRAYISH = 0.78 * 255;
const LINE_MAX_SATURATION = 0.3;

/**
 * 線（ペン・鉛筆）の画素を見つける。flattenPaper 後の画像に使う。
 * 写真のペン線はぼけて灰色になるので、真っ黒でなくても「紙より暗くて色みの少ない」画素は線とみなす。
 * ほっぺのピンクのような色の付いた部分は線にしない。
 */
export function detectLines(img: ImageData): Uint8Array {
  const { data } = img;
  const n = img.width * img.height;
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = luma(r, g, b);
    if (l < DARK) out[p] = 1;
    else if (l < GRAYISH) out[p] = saturation(r, g, b) < LINE_MAX_SATURATION ? 1 : 0;
  }
  return out;
}

const rise = (a: number, b: number) => (a === 0 && b === 1 ? 1 : 0);

/**
 * 線を中心線（1px 幅）まで細くする（Zhang–Suen の細線化）。
 * 中心線が通るマスだけを線にすると、線がマスの境目にかかっても2マスの太さにならない。
 */
export function thinLines(mask: Uint8Array, w: number, h: number): Uint8Array {
  const m = mask.slice();
  // 端の画素は扱わない
  for (let x = 0; x < w; x++) m[x] = m[(h - 1) * w + x] = 0;
  for (let y = 0; y < h; y++) m[y * w] = m[y * w + w - 1] = 0;
  let pixels: number[] = [];
  for (let p = 0; p < m.length; p++) if (m[p]) pixels.push(p);

  const del: number[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (const p of pixels) {
        // P2..P9: 上から時計回り
        const p2 = m[p - w], p3 = m[p - w + 1], p4 = m[p + 1], p5 = m[p + w + 1];
        const p6 = m[p + w], p7 = m[p + w - 1], p8 = m[p - 1], p9 = m[p - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        // 周りを1周したときの 0→1 の変わり目の数（1 なら線の端や途中で、消してもつながりが切れない）
        const a = rise(p2, p3) + rise(p3, p4) + rise(p4, p5) + rise(p5, p6) + rise(p6, p7) + rise(p7, p8) + rise(p8, p9) + rise(p9, p2);
        if (a !== 1) continue;
        if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(p);
      }
      for (const p of del) m[p] = 0;
      if (del.length) {
        changed = true;
        pixels = pixels.filter((p) => m[p]);
      }
    }
  }
  return m;
}

/**
 * 細線化した線のつながり（8近傍）ごとの長さ（画素数）を、各画素に書き込む。
 * ほっぺの斜線のような短い線を、マスの大きさに応じて無視するために使う。
 */
export function strokeLengths(skeleton: Uint8Array, w: number, h: number): Uint32Array {
  const out = new Uint32Array(skeleton.length);
  const stack: number[] = [];
  const members: number[] = [];
  for (let start = 0; start < skeleton.length; start++) {
    if (!skeleton[start] || out[start]) continue;
    members.length = 0;
    stack.push(start);
    out[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      members.push(p);
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (skeleton[q] && !out[q]) {
            out[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    for (const p of members) out[p] = members.length;
  }
  return out;
}

export type LineInfo = {
  /** 線の画素 */
  mask: Uint8Array;
  /** 線の中心線（1px） */
  skeleton: Uint8Array;
  /** 中心線の画素ごとの、その線の長さ */
  lengths: Uint32Array;
};

export function analyzeLines(img: ImageData): LineInfo {
  const mask = detectLines(img);
  const skeleton = thinLines(mask, img.width, img.height);
  return { mask, skeleton, lengths: strokeLengths(skeleton, img.width, img.height) };
}
