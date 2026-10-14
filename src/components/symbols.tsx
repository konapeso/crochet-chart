/**
 * かぎ針編み記号（JIS L 0201 に準拠した形）。
 * すべて (x, y, w, h) のボックス内に収まるように描く。
 * outline を渡すと、薄い色でも見えるよう下に縁取りを描く。
 */

export type SymbolProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  strokeWidth?: number;
  outline?: string;
};

export type SingleCrochetVariant = "x" | "plus";

const DEFAULT_COLOR = "#27272a";
const DEFAULT_STROKE = 1.5;

function Ink({ d, color = DEFAULT_COLOR, strokeWidth = DEFAULT_STROKE, outline }: { d: string } & Pick<SymbolProps, "color" | "strokeWidth" | "outline">) {
  return (
    <>
      {outline && <path d={d} fill="none" stroke={outline} strokeWidth={strokeWidth + 1.2} strokeLinecap="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  );
}

/** 鎖編み：横長の楕円 */
export function Chain({ x, y, w, h, color = DEFAULT_COLOR, strokeWidth = DEFAULT_STROKE, outline }: SymbolProps) {
  const rx = w * 0.42;
  const ry = Math.min(h * 0.42, rx * 0.6);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <>
      {outline && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={outline} strokeWidth={strokeWidth + 1.2} />}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={strokeWidth} />
    </>
  );
}

/** 引き抜き編み：黒の小さな楕円 */
export function SlipStitch({ x, y, w, h, color = DEFAULT_COLOR }: SymbolProps) {
  const rx = Math.min(w, h) * 0.24;
  return <ellipse cx={x + w / 2} cy={y + h / 2} rx={rx} ry={rx * 0.65} fill={color} />;
}

/** 細編み：× または ＋ */
export function SingleCrochet({ variant = "x", ...p }: SymbolProps & { variant?: SingleCrochetVariant }) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const s = Math.min(p.w, p.h) * (variant === "x" ? 0.3 : 0.36);
  const d =
    variant === "x"
      ? `M${cx - s} ${cy - s}L${cx + s} ${cy + s}M${cx + s} ${cy - s}L${cx - s} ${cy + s}`
      : `M${cx - s} ${cy}L${cx + s} ${cy}M${cx} ${cy - s}L${cx} ${cy + s}`;
  return <Ink d={d} color={p.color} strokeWidth={p.strokeWidth} outline={p.outline} />;
}

/** 中長編み・長編み・長々編みの共通の形（T 字 + 斜線 slashes 本） */
function tallStitchPath({ x, y, w, h }: SymbolProps, slashes: number): string {
  const cx = x + w / 2;
  const top = y + h * 0.1;
  const bottom = y + h * 0.94;
  const bar = Math.min(w * 0.4, h * 0.22);
  let d = `M${cx - bar} ${top}L${cx + bar} ${top}M${cx} ${top}L${cx} ${bottom}`;
  const mid = (top + bottom) / 2 + h * 0.04;
  const sx = bar * 0.75;
  const sy = sx * 0.6;
  const gap = Math.min(h * 0.09, bar * 0.6);
  for (let i = 0; i < slashes; i++) {
    const my = mid + (i - (slashes - 1) / 2) * gap;
    d += `M${cx - sx} ${my + sy}L${cx + sx} ${my - sy}`;
  }
  return d;
}

/** 中長編み：T */
export function HalfDoubleCrochet(p: SymbolProps) {
  return <Ink d={tallStitchPath(p, 0)} color={p.color} strokeWidth={p.strokeWidth} outline={p.outline} />;
}

/** 長編み：T の縦線に斜線1本 */
export function DoubleCrochet(p: SymbolProps) {
  return <Ink d={tallStitchPath(p, 1)} color={p.color} strokeWidth={p.strokeWidth} outline={p.outline} />;
}

/** 長々編み：T の縦線に斜線2本 */
export function TrebleCrochet(p: SymbolProps) {
  return <Ink d={tallStitchPath(p, 2)} color={p.color} strokeWidth={p.strokeWidth} outline={p.outline} />;
}

/** 立ち上がりの鎖：count 目を縦に積む */
export function TurningChain({ count, ...p }: SymbolProps & { count: number }) {
  const ch = p.h / count;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Chain key={i} {...p} y={p.y + i * ch} h={ch} />
      ))}
    </>
  );
}
