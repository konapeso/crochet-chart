import type { ReactNode } from "react";
import type { Mode } from "@/lib/pattern";
import { FILET_INK, type Yarn } from "@/lib/palette";
import {
  Chain,
  DoubleCrochet,
  HalfDoubleCrochet,
  SingleCrochet,
  type SingleCrochetVariant,
  SlipStitch,
  TrebleCrochet,
  TurningChain,
} from "./symbols";

function Icon({ children, h = 24 }: { children: ReactNode; h?: number }) {
  return (
    <svg viewBox={`0 0 24 ${h}`} width={28} height={(28 * h) / 24} className="shrink-0" aria-hidden>
      {children}
    </svg>
  );
}

function Row({ icon, name, note }: { icon: ReactNode; name: string; note?: string }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      {icon}
      <div className="leading-tight">
        <div className="text-sm font-medium">{name}</div>
        {note && <div className="text-xs text-zinc-500">{note}</div>}
      </div>
    </li>
  );
}

const box = { x: 2, y: 2, w: 20, h: 20 };
const tall = { x: 2, y: 1, w: 20, h: 38 };

export function Legend(props: {
  mode: Mode;
  scVariant: SingleCrochetVariant;
  cols: number;
  rows: number;
  palette: Yarn[];
  grid: Uint8Array;
}) {
  const { mode, scVariant, cols, rows, palette, grid } = props;
  const filet = mode === "filet";
  const counts = new Array<number>(filet ? 2 : palette.length).fill(0);
  for (const v of grid) counts[v]++;
  const total = grid.length;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-zinc-700">記号</h3>
        <ul className="divide-y divide-zinc-100">
          <Row icon={<Icon><Chain {...box} /></Icon>} name="鎖編み" />
          {filet ? (
            <>
              <Row icon={<Icon h={40}><DoubleCrochet {...tall} /></Icon>} name="長編み" />
              <Row icon={<Icon h={40}><TurningChain {...tall} count={3} /></Icon>} name="立ち上がりの鎖3目" note="長編み1目に数える" />
            </>
          ) : (
            <>
              <Row icon={<Icon><SingleCrochet {...box} variant={scVariant} /></Icon>} name="細編み" note="毛糸の色で表示" />
              <Row icon={<Icon><Chain {...box} /></Icon>} name="立ち上がりの鎖1目" note="目数に数えない" />
            </>
          )}
          <Row
            icon={
              <Icon>
                <path d="M20 12H4M9 7.5L4 12l5 4.5" fill="none" stroke="#52525b" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Icon>
            }
            name="編む向き"
            note="段数と矢印は編み始め側。1段目は右→左"
          />
        </ul>
        {filet && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            埋まったマス＝長編み3目 / 空きマス＝長編み1目＋鎖2目（マスの境目の長編みは隣と共有）
          </p>
        )}
        <details className="mt-2 text-xs text-zinc-500">
          <summary className="cursor-pointer py-1">その他の記号</summary>
          <ul className="mt-1 divide-y divide-zinc-100 text-zinc-800">
            <Row icon={<Icon><SingleCrochet {...box} variant={scVariant === "x" ? "plus" : "x"} /></Icon>} name="細編み（別表記）" />
            <Row icon={<Icon h={40}><HalfDoubleCrochet {...tall} /></Icon>} name="中長編み" />
            <Row icon={<Icon h={40}><TrebleCrochet {...tall} /></Icon>} name="長々編み" />
            <Row icon={<Icon><SlipStitch {...box} /></Icon>} name="引き抜き編み" />
          </ul>
        </details>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-zinc-700">配色表</h3>
        {filet ? (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              <tr>
                <td className="py-1.5">
                  <span className="mr-2 inline-block h-4 w-4 rounded-sm align-middle" style={{ background: FILET_INK }} />糸（単色）
                </td>
                <td className="py-1.5 text-right tabular-nums">1色</td>
              </tr>
              <tr>
                <td className="py-1.5">埋まったマス</td>
                <td className="py-1.5 text-right tabular-nums">{counts[1]}</td>
              </tr>
              <tr>
                <td className="py-1.5">空きマス</td>
                <td className="py-1.5 text-right tabular-nums">{counts[0]}</td>
              </tr>
              <tr>
                <td className="py-1.5">作り目</td>
                <td className="py-1.5 text-right tabular-nums">鎖 {cols * 3 + 1} 目</td>
              </tr>
              <tr>
                <td className="py-1.5">1段の目数</td>
                <td className="py-1.5 text-right tabular-nums">長編み {cols * 3 + 1} 目分</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 text-left font-normal">毛糸</th>
                <th className="py-1 text-right font-normal">目数</th>
                <th className="py-1 text-right font-normal">割合</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {palette.map((y, i) =>
                counts[i] === 0 ? null : (
                  <tr key={y.id}>
                    <td className="py-1.5">
                      <span
                        className="mr-2 inline-block h-4 w-4 rounded-sm align-middle ring-1 ring-zinc-300"
                        style={{ background: y.hex }}
                      />
                      {y.name}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{counts[i]}</td>
                    <td className="py-1.5 text-right tabular-nums">{Math.round((counts[i] / total) * 100)}%</td>
                  </tr>
                ),
              )}
              <tr className="text-zinc-500">
                <td className="py-1.5">作り目</td>
                <td className="py-1.5 text-right tabular-nums" colSpan={2}>
                  鎖 {cols} 目 / {rows} 段
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
