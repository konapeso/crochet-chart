/**
 * 紙に描いたイラスト・線画の写真向けの前処理。
 * - flattenPaper: 紙の影・色かぶりを取って、紙を白にする
 * - detectLines: 暗い線（ペン）のピクセルを見つける
 */

const BLOCK = 16;

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * 紙の明るさ（背景）を推定して割り算し、影と色かぶりを消す。
 * 16px ブロックごとに一番明るい画素を「紙の色」とみなし、
 * 線や目のような小さな暗い部分を無視できるよう広い範囲の最大値を取ってからなめらかにする。
 */
export function flattenPaper(src: ImageData): ImageData {
  const { width: w, height: h, data } = src;
  const gw = Math.ceil(w / BLOCK);
  const gh = Math.ceil(h / BLOCK);
  const n = gw * gh;
  // ブロックごとの一番明るい画素の色
  let bg = new Float32Array(n * 3);
  let bgL = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const gy = Math.floor(y / BLOCK);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = luma(data[i], data[i + 1], data[i + 2]);
      const g = gy * gw + Math.floor(x / BLOCK);
      if (l > bgL[g]) {
        bgL[g] = l;
        bg[g * 3] = data[i];
        bg[g * 3 + 1] = data[i + 1];
        bg[g * 3 + 2] = data[i + 2];
      }
    }
  }

  // 広い範囲の最大値（明るさで比べて色ごと持ち運ぶ）。横→縦の順に分けて計算する
  const radius = Math.max(2, Math.round(Math.max(w, h) / BLOCK / 6));
  const maxPass = (horizontal: boolean) => {
    const nb = new Float32Array(n * 3);
    const nl = new Float32Array(n);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let best = -1;
        let bi = 0;
        for (let k = -radius; k <= radius; k++) {
          const x = horizontal ? gx + k : gx;
          const y = horizontal ? gy : gy + k;
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          const j = y * gw + x;
          if (bgL[j] > best) {
            best = bgL[j];
            bi = j;
          }
        }
        const o = gy * gw + gx;
        nl[o] = best;
        nb[o * 3] = bg[bi * 3];
        nb[o * 3 + 1] = bg[bi * 3 + 1];
        nb[o * 3 + 2] = bg[bi * 3 + 2];
      }
    }
    bg = nb;
    bgL = nl;
  };
  maxPass(true);
  maxPass(false);

  // ブロックの境目が出ないよう、ぼかしてなめらかにする
  const blurPass = (horizontal: boolean) => {
    const nb = new Float32Array(n * 3);
    const r = Math.max(1, Math.round(radius / 2));
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let s0 = 0, s1 = 0, s2 = 0, cnt = 0;
        for (let k = -r; k <= r; k++) {
          const x = horizontal ? gx + k : gx;
          const y = horizontal ? gy : gy + k;
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
  };
  blurPass(true);
  blurPass(false);

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
const MAX_SATURATION = 0.3;

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
    if (l < DARK) {
      out[p] = 1;
    } else if (l < GRAYISH) {
      const max = Math.max(r, g, b);
      out[p] = (max - Math.min(r, g, b)) / max < MAX_SATURATION ? 1 : 0;
    }
  }
  return out;
}
