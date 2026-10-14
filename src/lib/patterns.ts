"use client";

import { useSyncExternalStore } from "react";
import type { Gauge, Mode } from "./pattern";
import type { SingleCrochetVariant } from "@/components/symbols";

/** 保存した編み図の毛糸（在庫から消えても表示できるよう、名前と色も持つ） */
export type SavedYarn = { id: string; name: string; colorNumber: string; colorName: string; hex: string };

export type SavedPattern = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mode: Mode;
  cols: number;
  rows: number;
  gauge: Gauge;
  scVariant: SingleCrochetVariant;
  palette: SavedYarn[];
  /** 上の行から順のマスの値（細編み: palette の番号 / 方眼編み: 1=埋まり）を base64 にしたもの */
  grid: string;
  /** 今編んでいる段（0 = 未開始） */
  currentRow: number;
  /** 一覧用の小さな画像（data URL） */
  thumbnail: string;
};

const KEY = "crochet-chart:patterns:v1";
const EMPTY: SavedPattern[] = [];
const listeners = new Set<() => void>();

let cacheRaw: string | null = null;
let cache: SavedPattern[] = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): SavedPattern[] {
  const raw = readRaw();
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as SavedPattern[]) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** 保存した編み図の一覧（新しい順）。サーバー描画時は空 */
export function useSavedPatterns(): SavedPattern[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** ブラウザで描画されたかどうか（保存データを読む前に「見つかりません」を出さないため） */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function write(list: SavedPattern[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === "QuotaExceededError"
        ? "保存容量がいっぱいです。使わない編み図を削除してください"
        : "保存できませんでした（プライベートブラウズでは保存できません）",
    );
  }
  listeners.forEach((l) => l());
}

export function newPatternId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 新規なら追加、同じ id があれば上書き（作成日時は引き継ぐ）。一覧は更新の新しい順 */
export function savePattern(p: SavedPattern) {
  const list = snapshot();
  const prev = list.find((x) => x.id === p.id);
  write([{ ...p, createdAt: prev?.createdAt ?? p.createdAt }, ...list.filter((x) => x.id !== p.id)]);
}

export function deletePattern(id: string) {
  write(snapshot().filter((x) => x.id !== id));
}

/** 段マーカーだけを更新する（並び順は変えない） */
export function updateCurrentRow(id: string, currentRow: number) {
  const list = snapshot();
  if (!list.some((x) => x.id === id)) return;
  try {
    write(list.map((x) => (x.id === id ? { ...x, currentRow } : x)));
  } catch {
    // 段マーカーの保存に失敗しても編み図の表示は続ける
  }
}

export function encodeGrid(grid: Uint8Array): string {
  let s = "";
  for (let i = 0; i < grid.length; i += 0x8000) s += String.fromCharCode(...grid.subarray(i, i + 0x8000));
  return btoa(s);
}

export function decodeGrid(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** 一覧用のサムネイル（1マス = 数ピクセルの小さな PNG） */
export function makeThumbnail(grid: Uint8Array, cols: number, rows: number, colors: string[], filet: boolean, cellAspect: number): string {
  const max = 160;
  const cw = Math.max(1, Math.floor(Math.min(max / cols, max / (rows * cellAspect))));
  const ch = Math.max(1, Math.round(cw * cellAspect));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r * cols + c];
      if (filet && !v) continue;
      ctx.fillStyle = colors[filet ? 0 : v] ?? "#000";
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }
  return canvas.toDataURL("image/png");
}
