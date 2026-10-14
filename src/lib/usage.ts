import type { Mode } from "./pattern";

/** 長編み1目 ＝ 細編み約2目分の糸 */
export const DC_TO_SC = 2;
/** 鎖1目 ＝ 細編み約0.5目分の糸（目安） */
export const CHAIN_TO_SC = 0.5;

export type ColorUsage = {
  /** パレット（使う毛糸）内の番号 */
  index: number;
  /** 細編み（方眼編みでは使わない） */
  sc: number;
  /** 長編み（方眼編みのみ） */
  dc: number;
  /** 鎖（作り目・立ち上がり・空きマス） */
  chains: number;
  /** 細編み換算の目数 */
  scEquivalent: number;
};

/**
 * 色ごとの目数を数える。buildChart と同じ編み方（往復編み・1段目は右→左）を前提にする。
 * grid は上の行から順に並ぶ（細編み: パレット番号 / 方眼編み: 1=埋まったマス）。
 */
export function countStitches(mode: Mode, cols: number, rows: number, grid: Uint8Array, paletteSize: number): ColorUsage[] {
  const usage = Array.from({ length: mode === "filet" ? 1 : paletteSize }, (_, index) => ({ index, sc: 0, dc: 0, chains: 0, scEquivalent: 0 }));
  if (mode === "filet") {
    let filled = 0;
    for (const v of grid) filled += v;
    const empty = grid.length - filled;
    const u = usage[0];
    // 1段: 境目の長編み cols+1 本のうち1本は立ち上がりの鎖3目、埋まったマスは中に長編み2目、空きマスは鎖2目
    u.dc = rows * cols + filled * 2;
    u.chains = cols * 3 + 1 + rows * 3 + empty * 2;
  } else {
    for (const v of grid) usage[v].sc++;
    // 作り目は1段目の編み始め（右下）の色、立ち上がりは各段の編み始めの色
    const at = (r: number, c: number) => grid[(rows - r) * cols + c];
    usage[at(1, cols - 1)].chains += cols;
    for (let r = 1; r <= rows; r++) usage[at(r, r % 2 === 1 ? cols - 1 : 0)].chains += 1;
  }
  for (const u of usage) u.scEquivalent = u.sc + u.dc * DC_TO_SC + u.chains * CHAIN_TO_SC;
  return usage;
}

export function gramsNeeded(scEquivalent: number, gramsPer100Sc: number): number {
  return (scEquivalent / 100) * gramsPer100Sc;
}
