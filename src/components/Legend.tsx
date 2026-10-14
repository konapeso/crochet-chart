import type { ReactNode } from "react";
import type { Mode } from "@/lib/pattern";
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
        {note && <div className="text-xs text-muted">{note}</div>}
      </div>
    </li>
  );
}

const box = { x: 2, y: 2, w: 20, h: 20 };
const tall = { x: 2, y: 1, w: 20, h: 38 };

/** 記号の凡例 */
export function Legend({ mode, scVariant }: { mode: Mode; scVariant: SingleCrochetVariant }) {
  const filet = mode === "filet";

  return (
    <div>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink">記号</h3>
        <ul className="divide-y divide-line/60">
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
          <p className="mt-2 text-xs leading-relaxed text-muted">
            埋まったマス＝長編み3目 / 空きマス＝長編み1目＋鎖2目（マスの境目の長編みは隣と共有）
          </p>
        )}
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer py-1">その他の記号</summary>
          <ul className="mt-1 divide-y divide-line/60 text-ink">
            <Row icon={<Icon><SingleCrochet {...box} variant={scVariant === "x" ? "plus" : "x"} /></Icon>} name="細編み（別表記）" />
            <Row icon={<Icon h={40}><HalfDoubleCrochet {...tall} /></Icon>} name="中長編み" />
            <Row icon={<Icon h={40}><TrebleCrochet {...tall} /></Icon>} name="長々編み" />
            <Row icon={<Icon><SlipStitch {...box} /></Icon>} name="引き抜き編み" />
          </ul>
        </details>
      </section>
    </div>
  );
}
