"use client";

import { type ReactNode, useMemo, useState } from "react";
import { hexToRgb, rgbToLab } from "@/lib/color";
import { loadImageFile, type SourceImage } from "@/lib/image";
import { PROVISIONAL_PALETTE } from "@/lib/palette";
import { binarize, cellSizeCm, cropRect, type Gauge, type Mode, quantize, sampleCells, suggestRows } from "@/lib/pattern";
import { buildChart } from "./chart";
import { Legend } from "./Legend";
import { NumberField } from "./NumberField";
import { PreviewCompare } from "./PreviewCompare";
import type { SingleCrochetVariant } from "./symbols";
import { ZoomableView } from "./ZoomableView";

const PALETTE = PROVISIONAL_PALETTE;
const PALETTE_LAB = PALETTE.map((y) => rgbToLab(hexToRgb(y.hex)));
const PALETTE_HEX = PALETTE.map((y) => y.hex);
// 白っぽい毛糸は白い背景で見えないので縁取りする
const PALETTE_OUTLINES = PALETTE_LAB.map((lab) => (lab[0] > 85 ? "#a1a1aa" : undefined));

const DEFAULT_GAUGE: Record<Mode, Gauge> = {
  tapestry: { stitches: 18, rows: 20 },
  filet: { stitches: 20, rows: 9 },
};
const MAX_COLS: Record<Mode, number> = { tapestry: 120, filet: 60 };
const MAX_ROWS = 120;

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-zinc-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-lg px-2 text-sm font-medium ${value === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ChartMaker() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("tapestry");
  const [cols, setCols] = useState(30);
  const [rows, setRows] = useState(30);
  const [gauges, setGauges] = useState(DEFAULT_GAUGE);
  const [dither, setDither] = useState(false);
  const [scVariant, setScVariant] = useState<SingleCrochetVariant>("x");
  const [threshold, setThreshold] = useState(50);
  const [invert, setInvert] = useState(false);

  const gauge = gauges[mode];
  const cell = useMemo(() => cellSizeCm(mode, gauge), [mode, gauge]);
  const colsLimited = Math.min(cols, MAX_COLS[mode]);

  const crop = useMemo(() => (source ? cropRect(source.width, source.height, colsLimited, rows, cell) : null), [source, colsLimited, rows, cell]);
  const cells = useMemo(() => (source && crop ? sampleCells(source.pixels, crop, colsLimited, rows) : null), [source, crop, colsLimited, rows]);
  const grid = useMemo(() => {
    if (!cells) return null;
    return mode === "tapestry" ? quantize(cells, colsLimited, rows, PALETTE_LAB, dither) : binarize(cells, threshold, invert);
  }, [cells, mode, colsLimited, rows, dither, threshold, invert]);
  const chart = useMemo(
    () =>
      grid &&
      buildChart({ mode, cols: colsLimited, rows, grid, gauge, colors: PALETTE_HEX, outlines: PALETTE_OUTLINES, scVariant }),
    [grid, mode, colsLimited, rows, gauge, scVariant],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      setSource(await loadImageFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  };

  const setGauge = (patch: Partial<Gauge>) => setGauges((g) => ({ ...g, [mode]: { ...g[mode], ...patch } }));
  const fitRows = () => source && setRows(Math.min(MAX_ROWS, suggestRows(source.width, source.height, colsLimited, cell)));
  const filet = mode === "filet";
  const size = { w: (colsLimited * cell.w).toFixed(1), h: (rows * cell.h).toFixed(1) };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4 pb-16">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Crochet Chart Maker</h1>
        <p className="mt-1 text-sm text-zinc-500">写真からかぎ針編みの編み図を作ります</p>
      </header>

      <Section title="1. 写真">
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-base font-semibold text-white active:bg-rose-700">
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
            <path d="M3 8h3.5L8 5.5h8L17.5 8H21v11H3z" />
            <circle cx={12} cy={13} r={3.5} />
          </svg>
          {source ? "写真を変える" : "写真を撮る / 選ぶ"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {loading && <p className="mt-2 text-sm text-zinc-500">読み込み中…</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Section>

      <Section title="2. 設定">
        <div className="space-y-4">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "tapestry", label: "細編みの編み込み" },
              { value: "filet", label: "方眼編み" },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField label={filet ? "マス数（横）" : "目数"} value={colsLimited} min={5} max={MAX_COLS[mode]} onChange={setCols} />
            <NumberField label="段数" value={rows} min={5} max={MAX_ROWS} onChange={setRows} />
          </div>
          {source && (
            <button type="button" onClick={fitRows} className="min-h-11 w-full rounded-lg bg-zinc-100 px-3 text-sm text-zinc-700 active:bg-zinc-200">
              写真の縦横比に合わせて段数を決める
            </button>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-zinc-600">{filet ? "長編み" : "細編み"}のゲージ（10cm 四方）</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="目" value={gauge.stitches} min={5} max={50} onChange={(v) => setGauge({ stitches: v })} />
              <NumberField label="段" value={gauge.rows} min={3} max={60} onChange={(v) => setGauge({ rows: v })} />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              仕上がり 約 {size.w} × {size.h} cm{filet && `（1段 長編み ${colsLimited * 3 + 1} 目分）`}
            </p>
          </div>

          {filet ? (
            <div>
              <label className="flex items-center justify-between text-sm">
                <span>しきい値（明るさ）</span>
                <span className="tabular-nums text-zinc-500">{threshold}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="h-11 w-full accent-rose-600"
              />
              <Toggle label="白黒を反転（明るい所を埋める）" checked={invert} onChange={setInvert} />
            </div>
          ) : (
            <div>
              <Toggle label="ディザリング" checked={dither} onChange={setDither} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">細編みの記号</span>
                <div className="w-32">
                  <Segmented
                    value={scVariant}
                    onChange={setScVariant}
                    options={[
                      { value: "x", label: "×" },
                      { value: "plus", label: "＋" },
                    ]}
                  />
                </div>
              </div>
              <p className="mt-3 mb-1 text-xs font-medium text-zinc-600">パレット（仮）</p>
              <ul className="flex flex-wrap gap-2">
                {PALETTE.map((y) => (
                  <li key={y.id} className="flex items-center gap-1.5 rounded-full bg-zinc-50 py-1 pr-2.5 pl-1 text-xs ring-1 ring-zinc-200">
                    <span className="h-5 w-5 rounded-full ring-1 ring-zinc-300" style={{ background: y.hex }} />
                    {y.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {source && crop && grid && chart ? (
        <>
          <Section title="3. プレビュー比較">
            <PreviewCompare source={source} crop={crop} mode={mode} cols={colsLimited} rows={rows} grid={grid} colors={PALETTE_HEX} />
          </Section>

          <Section title="4. 編み図" aside={<span className="text-xs text-zinc-500">ピンチで拡大・ダブルタップで全体</span>}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
              <ZoomableView width={chart.width} height={chart.height} label={`${filet ? "方眼編み" : "細編みの編み込み"}の編み図`}>
                {chart.content}
              </ZoomableView>
              <Legend mode={mode} scVariant={scVariant} cols={colsLimited} rows={rows} palette={PALETTE} grid={grid} />
            </div>
          </Section>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-500">写真を選ぶと、プレビューと編み図が表示されます</p>
      )}
    </div>
  );
}
