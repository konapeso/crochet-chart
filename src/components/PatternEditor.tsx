"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useReducer, useRef, useState } from "react";
import { hexToRgb, rgbToLab } from "@/lib/color";
import { applyEdits, EMPTY, EMPTY_HISTORY, FILLED, historyReducer, valueOf } from "@/lib/edits";
import { exportChartPng } from "@/lib/exportPng";
import { cellSizeCm, type Gauge, type Mode } from "@/lib/pattern";
import { encodeGrid, makeThumbnail, newPatternId, savePattern, updateCurrentRow } from "@/lib/patterns";
import { countStitches, gramsNeeded } from "@/lib/usage";
import { type Yarn, YARNS, yarnLabel } from "@/lib/yarns";
import { buildChart, cellAt, fromRight, rowEdge, rowTop } from "./chart";
import { Legend } from "./Legend";
import { Chain, DoubleCrochet, SingleCrochet, type SingleCrochetVariant } from "./symbols";
import { fmtG, UsageTable } from "./UsageTable";
import { YarnSwatch } from "./YarnSwatch";
import { type PaintHandlers, type Point, ZoomableView, type ZoomableViewHandle } from "./ZoomableView";

export type PatternEditorProps = {
  mode: Mode;
  cols: number;
  rows: number;
  gauge: Gauge;
  scVariant: SingleCrochetVariant;
  /** 使う毛糸（細編みの編み込み: base の値はこの番号 / 方眼編み: palette[0] の1色） */
  palette: Yarn[];
  /** 手直し前の編み図（上の行から順） */
  base: Uint8Array;
  /** 保存済みならその id（上書き保存になる） */
  savedId: string | null;
  defaultName: string;
  initialRow?: number;
  onSaved?: (id: string) => void;
  /** 塗る色に在庫の毛糸を足す（保存した編み図の編集で使う） */
  onAddYarn?: (id: string) => void;
};

const MODE_LABEL: Record<Mode, string> = { tapestry: "細編みの編み込み", filet: "方眼編み" };
const HIGHLIGHT = "#f59e0b";

const isLight = (hex: string) => rgbToLab(hexToRgb(hex))[0] > 85;

function ToolButton({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
        active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

/** 段の目を編む順に「同じ色が何目続くか」でまとめる */
function rowRuns(grid: Uint8Array, cols: number, rows: number, r: number): { value: number; count: number }[] {
  const row = rows - r;
  const order = Array.from({ length: cols }, (_, i) => (fromRight(r) ? cols - 1 - i : i));
  const runs: { value: number; count: number }[] = [];
  for (const c of order) {
    const v = grid[row * cols + c];
    const last = runs[runs.length - 1];
    if (last && last.value === v) last.count++;
    else runs.push({ value: v, count: 1 });
  }
  return runs;
}

/** 編み図の手直し・段マーカー・集計・保存・画像保存 */
export function PatternEditor(props: PatternEditorProps) {
  const { mode, cols, rows, gauge, scVariant, palette, base, savedId, defaultName, onSaved, onAddYarn } = props;
  const filet = mode === "filet";
  const paletteIds = useMemo(() => palette.map((y) => y.id), [palette]);
  const colors = useMemo(() => palette.map((y) => y.hex), [palette]);
  const outlines = useMemo(() => colors.map((hex) => (isLight(hex) ? "#a1a1aa" : undefined)), [colors]);

  const [history, dispatch] = useReducer(historyReducer, EMPTY_HISTORY);
  const grid = useMemo(() => applyEdits(base, history.present, mode, paletteIds), [base, history.present, mode, paletteIds]);
  const chart = useMemo(
    () => buildChart({ mode, cols, rows, grid, gauge, colors, outlines, scVariant }),
    [mode, cols, rows, grid, gauge, colors, outlines, scVariant],
  );
  const layout = chart.layout;
  const usage = useMemo(() => countStitches(mode, cols, rows, grid, palette.length), [mode, cols, rows, grid, palette.length]);

  // --- 手直し（なぞり塗り） ---
  const [tool, setTool] = useState<"move" | "paint">("move");
  const [brushId, setBrushId] = useState(palette[0]?.id ?? "");
  const brush = paletteIds.includes(brushId) ? brushId : paletteIds[0];
  const strokeRef = useRef<{ cells: Map<number, string>; target: string; last: Point } | null>(null);
  const [stroke, setStroke] = useState<Map<number, string> | null>(null);

  const addCells = (from: Point, to: Point) => {
    const s = strokeRef.current;
    if (!s) return false;
    const step = Math.min(layout.colW, layout.rowH) / 2;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    let added = false;
    for (let k = 0; k <= steps; k++) {
      const c = cellAt(layout, from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps);
      if (!c) continue;
      const i = c.row * cols + c.col;
      if (!s.cells.has(i)) {
        s.cells.set(i, s.target);
        added = true;
      }
    }
    return added;
  };

  const paint: PaintHandlers | null =
    tool === "paint" && palette.length > 0
      ? {
          start: (p) => {
            const c = cellAt(layout, p.x, p.y);
            if (!c) return;
            const i = c.row * cols + c.col;
            // 方眼編みは最初に触れたマスの反対（埋まり⇄空き）で、なぞったマスをそろえる
            const target = filet ? (valueOf(grid, i, mode, paletteIds) === FILLED ? EMPTY : FILLED) : brush;
            strokeRef.current = { cells: new Map([[i, target]]), target, last: p };
            setStroke(new Map(strokeRef.current.cells));
          },
          move: (p) => {
            const s = strokeRef.current;
            if (!s) return;
            if (addCells(s.last, p)) setStroke(new Map(s.cells));
            s.last = p;
          },
          end: (commit) => {
            const s = strokeRef.current;
            strokeRef.current = null;
            setStroke(null);
            if (!commit || !s) return;
            const next = new Map(history.present);
            for (const [i, v] of s.cells) {
              // 写真から作った値と同じに戻したマスは手直しから外す
              if (valueOf(base, i, mode, paletteIds) === v) next.delete(i);
              else next.set(i, v);
            }
            dispatch({ type: "commit", edits: next });
          },
        }
      : null;

  // 塗っている途中のマス（指を離すまでは編み図全体を描き直さず、上に重ねて描く）
  const strokeLayer = stroke && (
    <g>
      {[...stroke].map(([i, v]) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const y = rowTop(layout, rows - row);
        if (!filet) {
          const idx = paletteIds.indexOf(v);
          const box = { x: layout.gridX + col * layout.colW, y, w: layout.colW, h: layout.rowH };
          return (
            <g key={i}>
              <rect {...box} fill="#fff7ed" />
              <SingleCrochet {...box} strokeWidth={1.6} variant={scVariant} color={colors[idx]} outline={outlines[idx]} />
            </g>
          );
        }
        const x = layout.gridX + (col * 3 + 1) * layout.colW;
        const ink = { color: colors[0], outline: outlines[0], strokeWidth: 1.3 };
        return (
          <g key={i}>
            <rect x={x} y={y} width={layout.colW * 2} height={layout.rowH} fill="#fff7ed" />
            {[0, 1].map((k) =>
              v === FILLED ? (
                <DoubleCrochet key={k} x={x + k * layout.colW} y={y} w={layout.colW} h={layout.rowH} {...ink} />
              ) : (
                <Chain key={k} x={x + k * layout.colW} y={y} w={layout.colW} h={layout.rowH * 0.36} {...ink} />
              ),
            )}
          </g>
        );
      })}
    </g>
  );

  // --- 段マーカー ---
  const [rowState, setRowState] = useState(props.initialRow ?? 0);
  const currentRow = Math.min(rowState, rows);
  const setRow = (r: number) => {
    const next = Math.max(0, Math.min(rows, r));
    setRowState(next);
    if (savedId) updateCurrentRow(savedId, next);
  };
  const focus = useMemo(
    () => (currentRow > 0 ? { x: 0, y: rowTop(layout, currentRow), w: layout.width, h: layout.rowH } : null),
    [currentRow, layout],
  );
  const edge = currentRow > 0 ? rowEdge(layout, currentRow) : null;
  const rowLayer = edge && focus && (
    <g pointerEvents="none">
      <rect x={focus.x} y={focus.y} width={focus.w} height={focus.h} fill="#fde68a" fillOpacity={0.45} stroke={HIGHLIGHT} strokeWidth={1.5} />
      <path d={edge.arrow} fill="none" stroke="#d97706" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <text
        x={edge.labelX}
        y={edge.cy}
        dominantBaseline="central"
        textAnchor={edge.anchor}
        fontSize={13}
        fontWeight={800}
        fill="#b45309"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {currentRow}
      </text>
    </g>
  );
  const runs = currentRow > 0 ? rowRuns(grid, cols, rows, currentRow) : [];

  // --- 保存・画像 ---
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [png, setPng] = useState<{ url: string; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const viewRef = useRef<ZoomableViewHandle>(null);
  const cell = cellSizeCm(mode, gauge);
  const sizeLabel = `仕上がり 約 ${(cols * cell.w).toFixed(1)} × ${(rows * cell.h).toFixed(1)} cm`;
  const title = name.trim() || defaultName;

  const save = () => {
    const id = savedId ?? newPatternId();
    const now = Date.now();
    try {
      savePattern({
        id,
        name: title,
        createdAt: now,
        updatedAt: now,
        mode,
        cols,
        rows,
        gauge,
        scVariant,
        palette: palette.map(({ id, name, colorNumber, colorName, hex }) => ({ id, name, colorNumber, colorName, hex })),
        grid: encodeGrid(grid),
        currentRow,
        thumbnail: makeThumbnail(grid, cols, rows, colors, filet, cell.h / cell.w),
      });
      onSaved?.(id);
      setMessage({ text: savedId ? "上書き保存しました" : "保存しました" });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "保存できませんでした", error: true });
    }
  };

  const closePng = () => {
    if (png) URL.revokeObjectURL(png.url);
    setPng(null);
  };

  const makePng = async () => {
    const svg = viewRef.current?.getSvg();
    if (!svg) return;
    setBusy(true);
    try {
      const blob = await exportChartPng({
        svg,
        width: chart.width,
        height: chart.height,
        title,
        subtitle: `${MODE_LABEL[mode]}・${filet ? "マス" : "目"}数 ${cols} × ${rows} 段・${sizeLabel}`,
        yarns: usage
          .filter((u) => u.sc + u.dc + u.chains > 0)
          .map((u) => {
            const y = palette[u.index];
            const need = gramsNeeded(u.scEquivalent, y.gramsPer100Sc);
            return {
              hex: y.hex,
              label: `${yarnLabel(y)} ${y.colorName}`,
              detail: `${filet ? `長編み ${u.dc}` : `細編み ${u.sc}`} 目・約 ${fmtG(need)} g`,
              short: need > y.remainingGrams,
            };
          }),
        legend: filet
          ? "記号: ○ 鎖編み / T に斜線 長編み / 立ち上がり鎖3目は長編み1目に数える / 1段目は右→左"
          : `記号: ○ 鎖編み / ${scVariant === "x" ? "×" : "＋"} 細編み（毛糸の色）/ 立ち上がり鎖1目 / 1段目は右→左`,
      });
      closePng();
      const file = new File([blob], `${title.replace(/[\\/:*?"<>|]/g, "_")}.png`, { type: "image/png" });
      setPng({ url: URL.createObjectURL(blob), file });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "画像を作れませんでした", error: true });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!png) return;
    // iOS の共有シート（「画像を保存」で写真に入る）。画像はもう作ってあるので、タップ直後に呼べる
    if (navigator.canShare?.({ files: [png.file] })) {
      try {
        await navigator.share({ files: [png.file], title });
      } catch {
        // 共有シートを閉じただけ
      }
      return;
    }
    const a = document.createElement("a");
    a.href = png.url;
    a.download = png.file.name;
    a.click();
  };

  const iconBtn =
    "flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg bg-zinc-100 px-3 text-sm text-zinc-700 active:bg-zinc-200 disabled:opacity-40";
  const addable = onAddYarn && !filet ? YARNS.filter((y) => !paletteIds.includes(y.id)) : [];

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-xl bg-zinc-100 p-1">
            <ToolButton active={tool === "move"} onClick={() => setTool("move")} label="移動・拡大">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
              </svg>
              移動
            </ToolButton>
            <ToolButton active={tool === "paint"} onClick={() => setTool("paint")} label="塗って手直し">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
                <path d="M14.5 4.5l5 5L9 20H4v-5z" />
                <path d="M12.5 6.5l5 5" />
              </svg>
              塗る
            </ToolButton>
          </div>
          <button type="button" className={iconBtn} aria-label="元に戻す" disabled={history.past.length === 0} onClick={() => dispatch({ type: "undo" })}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button type="button" className={iconBtn} aria-label="やり直し" disabled={history.future.length === 0} onClick={() => dispatch({ type: "redo" })}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 14l5-5-5-5" />
              <path d="M20 9H10a6 6 0 000 12h3" />
            </svg>
          </button>
        </div>
        {tool === "paint" &&
          (filet ? (
            <p className="text-xs text-zinc-500">マスをタップすると「埋まり ⇄ 空き」が切り替わります。なぞると最初のマスと同じにそろいます</p>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="塗る毛糸">
              {palette.map((y) => (
                <button
                  key={y.id}
                  type="button"
                  role="radio"
                  aria-checked={y.id === brush}
                  aria-label={`${yarnLabel(y)} ${y.colorName}`}
                  onClick={() => setBrushId(y.id)}
                  className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-xs ring-1 ${
                    y.id === brush ? "bg-rose-50 font-medium ring-2 ring-rose-500" : "bg-white text-zinc-500 ring-zinc-200"
                  }`}
                >
                  <YarnSwatch yarn={y} size={24} />
                  {y.colorName}
                </button>
              ))}
              {addable.length > 0 && (
                <select
                  aria-label="塗る毛糸を追加"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onAddYarn?.(e.target.value);
                    setBrushId(e.target.value);
                  }}
                  className="h-11 shrink-0 rounded-full border border-dashed border-zinc-300 bg-white px-3 text-base text-zinc-500"
                >
                  <option value="">＋ 毛糸を追加</option>
                  {addable.map((y) => (
                    <option key={y.id} value={y.id}>
                      {yarnLabel(y)} {y.colorName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        <p className="text-xs text-zinc-500">
          {tool === "paint" ? "1本指でなぞって塗る・2本指で移動と拡大" : "ピンチで拡大・ダブルタップで全体"}
          {history.present.size > 0 && `・手直し ${history.present.size} マス`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <ZoomableView
          width={chart.width}
          height={chart.height}
          label={`${MODE_LABEL[mode]}の編み図`}
          paint={paint}
          focus={focus}
          handleRef={viewRef}
          overlay={
            (rowLayer || strokeLayer) && (
              <>
                {rowLayer}
                {strokeLayer}
              </>
            )
          }
        >
          {chart.content}
        </ZoomableView>
        <Legend mode={mode} scVariant={scVariant} />
      </div>

      {/* 段マーカー */}
      <section className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200" aria-label="段マーカー">
        {currentRow === 0 ? (
          <button type="button" onClick={() => setRow(1)} className="min-h-12 w-full rounded-lg bg-amber-500 text-base font-semibold text-white active:bg-amber-600">
            編み始める（1段目から）
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-bold text-amber-900 tabular-nums">
                {currentRow} <span className="text-sm font-normal">/ {rows} 段目</span>
              </p>
              <p className="text-sm font-semibold text-amber-800">{fromRight(currentRow) ? "← 右から左へ" : "左から右へ →"}</p>
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-amber-900">
              <span className="text-amber-700">立ち上がり鎖{filet ? 3 : 1}目 →</span>
              {runs.map((run, k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 ring-1 ring-amber-200 tabular-nums">
                  {filet ? (
                    run.value ? "埋" : "空"
                  ) : (
                    <span className="h-3 w-3 rounded-full ring-1 ring-black/15" style={{ background: colors[run.value] }} />
                  )}
                  ×{run.count}
                </span>
              ))}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRow(currentRow - 1)} className="min-h-12 w-24 rounded-lg bg-white text-sm text-amber-900 ring-1 ring-amber-300 active:bg-amber-100">
                ← 前の段
              </button>
              <button
                type="button"
                onClick={() => setRow(currentRow + 1)}
                disabled={currentRow >= rows}
                className="min-h-12 flex-1 rounded-lg bg-amber-500 text-base font-semibold text-white active:bg-amber-600 disabled:opacity-40"
              >
                {currentRow >= rows ? "編み終わり" : `次の段へ（${currentRow + 1}段目）`}
              </button>
            </div>
            <button type="button" onClick={() => setRow(0)} className="text-xs text-amber-700 underline">
              マーカーを消す
            </button>
          </div>
        )}
      </section>

      <div className="border-t border-zinc-100 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700">色ごとの目数と必要量</h3>
          <Link href="/yarns" className="text-xs text-rose-700 underline">
            在庫を見る
          </Link>
        </div>
        <UsageTable mode={mode} palette={palette} usage={usage} />
      </div>

      {/* 保存 */}
      <section className="space-y-2 border-t border-zinc-100 pt-4" aria-label="保存">
        <h3 className="text-sm font-semibold text-zinc-700">保存</h3>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-600">名前</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base"
            placeholder={defaultName}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={save} className="min-h-12 rounded-lg bg-rose-600 text-sm font-semibold text-white active:bg-rose-700">
            {savedId ? "上書き保存" : "この端末に保存"}
          </button>
          <button
            type="button"
            onClick={makePng}
            disabled={busy}
            className="min-h-12 rounded-lg bg-zinc-800 text-sm font-semibold text-white active:bg-zinc-900 disabled:opacity-50"
          >
            {busy ? "画像を作成中…" : "画像（PNG）にする"}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${message.error ? "text-red-600" : "text-emerald-700"}`} role="status">
            {message.text}
            {!message.error && (
              <>
                {" "}
                <Link href="/patterns" className="underline">
                  保存した編み図
                </Link>
              </>
            )}
          </p>
        )}
        {png && (
          <div className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- 端末内で作った blob URL の画像 */}
            <img src={png.url} alt={`${title} の編み図の画像`} className="max-h-80 w-full rounded-lg bg-white object-contain ring-1 ring-zinc-200" />
            <p className="text-xs text-zinc-500">「共有」から「画像を保存」で写真に保存できます（画像の長押しでも保存できます）</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={share} className="min-h-12 rounded-lg bg-zinc-800 text-sm font-semibold text-white active:bg-zinc-900">
                共有・写真に保存
              </button>
              <button type="button" onClick={closePng} className="min-h-12 rounded-lg bg-white px-4 text-sm text-zinc-600 ring-1 ring-zinc-300">
                閉じる
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-zinc-500">保存先はこの端末のブラウザです（別の端末やブラウザとは共有されません）</p>
      </section>
    </div>
  );
}
