import type { Mode } from "./pattern";

/**
 * 手直し（マス番号 → 値）。写真から作った編み図に重ねるので、しきい値などを変えても手直しは残る。
 * 細編みの編み込みは毛糸の id、方眼編みは "1"（埋まり）/ "0"（空き）。
 */
export type Edits = ReadonlyMap<number, string>;

export const FILLED = "1";
export const EMPTY = "0";

/** 手直しを反映した編み図。使う毛糸に入っていない毛糸での手直しは無視する */
export function applyEdits(base: Uint8Array, edits: Edits, mode: Mode, paletteIds: string[]): Uint8Array {
  if (edits.size === 0) return base;
  const out = base.slice();
  for (const [i, v] of edits) {
    if (i >= out.length) continue;
    if (mode === "filet") {
      out[i] = v === FILLED ? 1 : 0;
    } else {
      const idx = paletteIds.indexOf(v);
      if (idx >= 0) out[i] = idx;
    }
  }
  return out;
}

/** マスの値を手直し用の値にする */
export function valueOf(grid: Uint8Array, i: number, mode: Mode, paletteIds: string[]): string {
  return mode === "filet" ? (grid[i] ? FILLED : EMPTY) : paletteIds[grid[i]];
}

const MAX_HISTORY = 100;

export type History = { past: Edits[]; present: Edits; future: Edits[] };

export type HistoryAction = { type: "commit"; edits: Edits } | { type: "undo" } | { type: "redo" } | { type: "reset" };

export const EMPTY_HISTORY: History = { past: [], present: new Map(), future: [] };

/** 元に戻す / やり直し。ひと筆（指を離すまで）が1回分 */
export function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case "commit":
      return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: a.edits, future: [] };
    case "undo":
      if (h.past.length === 0) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    case "redo":
      if (h.future.length === 0) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    case "reset":
      return EMPTY_HISTORY;
  }
}
