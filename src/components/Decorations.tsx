import type { ReactNode } from "react";

/** 手描き風の飾り（毛糸玉・かぎ針・ゆらいだ形）。すべて装飾なので読み上げない */

/** 毛糸玉 */
export function YarnBall({ size = 32, color = "#cf7569", line = "#2b2a25", className }: { size?: number; color?: string; line?: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <path d="M40 38c3 1 5 3 6 6" fill="none" stroke={line} strokeWidth={2} strokeLinecap="round" />
      <circle cx={23} cy={24} r={19} fill={color} stroke={line} strokeWidth={2} />
      <g fill="none" stroke={line} strokeWidth={1.6} strokeLinecap="round" opacity={0.75}>
        <path d="M9 15c8 2 18 9 23 24" />
        <path d="M6 24c9 0 20 6 23 17" />
        <path d="M14 8c10 5 19 15 21 28" />
        <path d="M31 8c-6 9-9 21-7 34" />
      </g>
    </svg>
  );
}

/** かぎ針 */
export function CrochetHook({ size = 32, color = "#687a5d", line = "#2b2a25", className }: { size?: number; color?: string; line?: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <path d="M9 42L35 10" stroke={line} strokeWidth={7} strokeLinecap="round" />
      <path d="M9 42L35 10" stroke={color} strokeWidth={4.4} strokeLinecap="round" />
      <path d="M35 10c2-3 6-4 7-1s-2 5-4 4" fill="none" stroke={line} strokeWidth={2.2} strokeLinecap="round" />
      <rect x={17} y={24} width={9} height={5} rx={1.5} transform="rotate(-51 21.5 26.5)" fill="#e3dc84" stroke={line} strokeWidth={1.4} />
    </svg>
  );
}

/** 雲のようにゆらいだ形（参考サイトのブロブ） */
export function Blob({ color, className, variant = "cloud" }: { color: string; className?: string; variant?: "cloud" | "flower" }) {
  const d =
    variant === "cloud"
      ? "M60 6c17-3 29 9 33 20 9 3 21 13 17 30 10 11 6 31-9 36-4 15-22 21-34 14-13 8-32 3-37-11C14 92 2 78 9 63 0 52 3 33 17 27 21 14 41 3 60 6z"
      : "M60 4l11 18 21-6-3 21 20 8-16 15 12 18-21 4 1 21-19-9-9 19-11-18-20 9 2-21-21-5 13-17L5 49l20-8-3-21 21 6z";
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden preserveAspectRatio="none">
      <path d={d} fill={color} />
    </svg>
  );
}

/** 細編みの「×」を並べた区切り線 */
export function StitchDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sage ${className}`} aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <svg key={i} viewBox="0 0 10 10" width={9} height={9}>
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

/** ページの見出し（英語の大見出し＋日本語の添え書き） */
export function PageTitle({ en, ja, aside }: { en: string; ja: string; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2">
      <div>
        <h1 className="font-display text-3xl leading-none">{en}</h1>
        <p className="mt-1.5 text-sm font-bold text-muted">{ja}</p>
      </div>
      {aside}
    </div>
  );
}
