"use client";

import { type ReactNode, useMemo, useState } from "react";
import { hexToRgb, rgbToLab } from "@/lib/color";
import { loadImageFile, type SourceImage } from "@/lib/image";
import { analyzeLines, flattenPaper } from "@/lib/lineart";
import {
  binarize,
  boostChroma,
  cellSizeCm,
  smoothCells,
  cropRect,
  type CropView,
  DEFAULT_VIEW,
  type Gauge,
  lineCells,
  type Mode,
  quantize,
  sampleCells,
  suggestRows,
} from "@/lib/pattern";
import { type Yarn, YARNS, yarnLabel } from "@/lib/yarns";
import Link from "next/link";
import { NumberField } from "./NumberField";
import { PatternEditor } from "./PatternEditor";
import { PreviewCompare } from "./PreviewCompare";
import type { SingleCrochetVariant } from "./symbols";
import { YarnSwatch } from "./YarnSwatch";

const YARN_LAB = new Map(YARNS.map((y) => [y.id, rgbToLab(hexToRgb(y.hex))]));
/** 白っぽい毛糸（白い背景で見えにくい） */
const isLight = (y: Yarn) => (YARN_LAB.get(y.id)?.[0] ?? 0) > 85;

const DEFAULT_GAUGE: Record<Mode, Gauge> = {
  tapestry: { stitches: 18, rows: 20 },
  filet: { stitches: 20, rows: 9 },
};
const MAX_COLS: Record<Mode, number> = { tapestry: 120, filet: 60 };
const MAX_ROWS = 120;
const MAX_ZOOM = 5;

/** 線の感度（0〜100）→ マスを通る線の長さのしきい値（マスの一辺に対する倍率） */
const lineThreshold = (sensitivity: number) => 1 - (sensitivity / 100) * 0.8;
/** 減色: 明るさの差を軽く見る（淡い塗りでも色みの近い毛糸を選ぶ） */
const COLOR_KL = 2;

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

function YarnOption({ yarn, selected, onClick, role }: { yarn: Yarn; selected: boolean; onClick: () => void; role: "checkbox" | "radio" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-left text-xs ring-1 ${
        selected ? "bg-rose-50 font-medium text-zinc-900 ring-2 ring-rose-500" : "bg-white text-zinc-500 ring-zinc-200"
      }`}
    >
      <YarnSwatch yarn={yarn} size={26} />
      <span className="leading-tight">
        {yarnLabel(yarn)}
        <span className="block text-[11px] text-zinc-500">
          {yarn.colorName}・残 {yarn.remainingGrams}g
        </span>
      </span>
    </button>
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
  const [tapestryIds, setTapestryIds] = useState<string[]>(() => YARNS.map((y) => y.id));
  const [filetId, setFiletId] = useState<string | undefined>(() => YARNS[0]?.id);
  const [lineSensitivity, setLineSensitivity] = useState(75);
  /** 線の色にする毛糸（"" = 選んだ毛糸のうち一番暗いもの） */
  const [lineYarnId, setLineYarnId] = useState("");
  const [view, setView] = useState<CropView>(DEFAULT_VIEW);
  /** 写真を選び直した回数（手直しは写真ごと） */
  const [photoSeq, setPhotoSeq] = useState(0);
  const [patternName, setPatternName] = useState("");
  /** この端末に保存した編み図の id（2回目からは上書き保存） */
  const [savedId, setSavedId] = useState<string | null>(null);

  // 使う毛糸（細編みの編み込み: 選んだ毛糸すべて / 方眼編み: 1色）。在庫の並び順を保つ
  const palette = useMemo(
    () => YARNS.filter((y) => (mode === "filet" ? y.id === filetId : tapestryIds.includes(y.id))),
    [mode, filetId, tapestryIds],
  );
  const paletteLab = useMemo(() => palette.map((y) => YARN_LAB.get(y.id)!), [palette]);
  const colors = useMemo(() => palette.map((y) => y.hex), [palette]);

  const gauge = gauges[mode];
  const cell = useMemo(() => cellSizeCm(mode, gauge), [mode, gauge]);
  const colsLimited = Math.min(cols, MAX_COLS[mode]);

  // 紙の影を補正してから線を探す（写真を選び直したときだけ計算）
  const pixels = useMemo(() => (source ? flattenPaper(source.pixels) : null), [source]);
  const lineInfo = useMemo(() => (pixels ? analyzeLines(pixels) : null), [pixels]);

  const crop = useMemo(
    () => (source ? cropRect(source.width, source.height, colsLimited, rows, cell, view) : null),
    [source, colsLimited, rows, cell, view],
  );
  const sampled = useMemo(
    () => (pixels && crop ? sampleCells(pixels, crop, colsLimited, rows, lineInfo) : null),
    [pixels, crop, colsLimited, rows, lineInfo],
  );
  const lines = useMemo(
    () =>
      sampled?.lineCoverage && sampled.lineLength ? lineCells(sampled.lineCoverage, sampled.lineLength, lineThreshold(lineSensitivity)) : null,
    [sampled, lineSensitivity],
  );
  // 線の色: 指定した毛糸（使う毛糸に入っていれば）か、使う毛糸のうち一番暗いもの
  const lineIndex = useMemo(() => {
    const chosen = palette.findIndex((y) => y.id === lineYarnId);
    if (chosen >= 0) return chosen;
    let best = 0;
    paletteLab.forEach((lab, i) => {
      if (lab[0] < paletteLab[best][0]) best = i;
    });
    return best;
  }, [palette, paletteLab, lineYarnId]);
  const grid = useMemo(() => {
    if (!sampled || palette.length === 0) return null;
    return mode === "tapestry"
      ? quantize(boostChroma(smoothCells(sampled.labs, colsLimited, rows, lines)), colsLimited, rows, paletteLab, dither, lines, lineIndex, COLOR_KL)
      : binarize(sampled.labs, threshold, invert, lines);
  }, [sampled, palette, mode, colsLimited, rows, paletteLab, dither, lines, lineIndex, threshold, invert]);
  const toggleTapestry = (id: string) =>
    setTapestryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      setSource(await loadImageFile(file));
      setView(DEFAULT_VIEW);
      setPhotoSeq((n) => n + 1);
      setSavedId(null);
      setPatternName(`編み図 ${new Date().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
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
      <p className="text-sm text-zinc-500">写真からかぎ針編みの編み図を作ります</p>

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
        <p className="mt-2 text-xs text-zinc-500">紙の影を補正して白くし、細い線を拾って「線の色」で編みます</p>
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
            </div>
          )}

          <div className="space-y-1 rounded-xl bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-600">線画</p>
            <label className="flex items-center justify-between text-sm">
              <span>線の感度</span>
              <span className="tabular-nums text-zinc-500">{lineSensitivity}</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={lineSensitivity}
              onChange={(e) => setLineSensitivity(Number(e.target.value))}
              className="h-11 w-full accent-rose-600"
              aria-label="線の感度"
            />
            <p className="text-xs text-zinc-500">上げると細い線・かすれた線も拾います。線が太くなりすぎたら下げてください</p>
            {!filet && palette.length > 0 && (
              <label className="flex min-h-11 items-center justify-between gap-3 pt-1 text-sm">
                <span className="shrink-0">線の色</span>
                <select
                  value={palette.some((y) => y.id === lineYarnId) ? lineYarnId : ""}
                  onChange={(e) => setLineYarnId(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-base"
                >
                  <option value="">自動（いちばん暗い毛糸: {yarnLabel(palette[lineIndex])}）</option>
                  {palette.map((y) => (
                    <option key={y.id} value={y.id}>
                      {yarnLabel(y)} {y.colorName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-600">
                使う毛糸{filet ? "（1色）" : `（選んだ色だけで減色・${tapestryIds.length}/${YARNS.length} 色）`}
              </p>
              {!filet && YARNS.length > 0 && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="min-h-9 rounded-md px-2 text-xs text-rose-700 active:bg-rose-50" onClick={() => setTapestryIds(YARNS.map((y) => y.id))}>
                    すべて選ぶ
                  </button>
                  <button type="button" className="min-h-9 rounded-md px-2 text-xs text-zinc-500 active:bg-zinc-100" onClick={() => setTapestryIds([])}>
                    すべて外す
                  </button>
                </div>
              )}
            </div>
            {YARNS.length === 0 ? (
              <p className="text-sm text-zinc-500">
                在庫に毛糸がありません。<Link href="/yarns" className="text-rose-700 underline">毛糸の在庫</Link>を確認してください
              </p>
            ) : (
              <div role={filet ? "radiogroup" : "group"} aria-label="使う毛糸" className="flex flex-wrap gap-2">
                {YARNS.map((y) =>
                  filet ? (
                    <YarnOption key={y.id} yarn={y} role="radio" selected={y.id === filetId} onClick={() => setFiletId(y.id)} />
                  ) : (
                    <YarnOption key={y.id} yarn={y} role="checkbox" selected={tapestryIds.includes(y.id)} onClick={() => toggleTapestry(y.id)} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </Section>

      {source && crop && grid ? (
        <>
          <Section title="3. プレビュー比較">
            <PreviewCompare
              source={source}
              crop={crop}
              mode={mode}
              cols={colsLimited}
              rows={rows}
              grid={grid}
              colors={colors}
              backdrop={filet && palette[0] && isLight(palette[0]) ? "#52525b" : "#ffffff"}
              onCropMove={(r) => setView((v) => ({ ...v, cx: (r.x + r.w / 2) / source.width, cy: (r.y + r.h / 2) / source.height }))}
            />
            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="crop-zoom" className="shrink-0 text-sm">
                拡大
              </label>
              <input
                id="crop-zoom"
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.1}
                value={view.zoom}
                onChange={(e) => setView((v) => ({ ...v, zoom: Number(e.target.value) }))}
                className="h-11 min-w-0 flex-1 accent-rose-600"
              />
              <span className="w-10 text-right text-sm tabular-nums text-zinc-500">{view.zoom.toFixed(1)}x</span>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-lg bg-zinc-100 px-3 text-xs text-zinc-700 active:bg-zinc-200"
                onClick={() => setView(DEFAULT_VIEW)}
              >
                リセット
              </button>
            </div>
            <p className="text-xs text-zinc-500">編みたい部分だけを拡大して、元の写真をドラッグで位置合わせすると細部が残りやすくなります</p>
          </Section>

          <Section title="4. 編み図">
            <p className="mb-3 text-xs text-zinc-500">目数・段数・編み方を変えたり写真を選び直したりすると、手直しは消えます</p>
            <PatternEditor
              // 目数・段数・編み方・写真が変わったら手直しを捨てる（しきい値などの調整では残す）
              key={`${photoSeq}-${mode}-${colsLimited}-${rows}`}
              mode={mode}
              cols={colsLimited}
              rows={rows}
              gauge={gauge}
              scVariant={scVariant}
              palette={palette}
              base={grid}
              savedId={savedId}
              defaultName={patternName || "編み図"}
              onSaved={setSavedId}
            />
          </Section>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-500">
          {source && palette.length === 0 ? "使う毛糸を1色以上選んでください" : "写真を選ぶと、プレビューと編み図が表示されます"}
        </p>
      )}
    </div>
  );
}
