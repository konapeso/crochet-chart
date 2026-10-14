import type { ReactNode } from "react";
import type { Gauge, Mode } from "@/lib/pattern";
import { Chain, DoubleCrochet, SingleCrochet, type SingleCrochetVariant, TurningChain } from "./symbols";

export type ChartParams = {
  mode: Mode;
  /** 細編み: 目数 / 方眼編み: マス数 */
  cols: number;
  rows: number;
  /** 上の行から順に並んだマスの値（細編み: パレット番号 / 方眼編み: 1=埋まったマス） */
  grid: Uint8Array;
  gauge: Gauge;
  /** 使う毛糸の色（方眼編みは colors[0] の1色） */
  colors: string[];
  /** 薄い色の縁取り色（不要なら undefined） */
  outlines: (string | undefined)[];
  scVariant: SingleCrochetVariant;
};

/** 編み図の寸法。タップ位置からマスを求めたり、段をハイライトしたりするのに使う */
export type ChartLayout = {
  filet: boolean;
  cols: number;
  rows: number;
  /** 横方向の目数（方眼編みは 3×マス数+1） */
  n: number;
  colW: number;
  rowH: number;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
};

export type Chart = { width: number; height: number; content: ReactNode; layout: ChartLayout };

/** r 段目（1段目が一番下）の上端 */
export const rowTop = (l: ChartLayout, r: number) => l.gridY + (l.rows - r) * l.rowH;

/** 奇数段は右→左、偶数段は左→右 */
export const fromRight = (r: number) => r % 2 === 1;

/**
 * SVG 上の点がどのマスか。row は上の行から数えた番号（grid の行）、col は目（方眼編みはマス）の番号。
 * 編み図の外なら null。
 */
export function cellAt(l: ChartLayout, x: number, y: number): { row: number; col: number } | null {
  const gx = x - l.gridX;
  if (gx < 0 || gx >= l.n * l.colW) return null;
  const row = Math.floor((y - l.gridY) / l.rowH);
  // 方眼編みのマスは長編み3目分（右端の境目の長編みは一番右のマスに含める）
  const col = Math.min(l.cols - 1, Math.floor(gx / (l.filet ? l.colW * 3 : l.colW)));
  if (row < 0 || row >= l.rows) return null;
  return { row, col };
}

/** 編む向きの矢印と段数の位置（編み始め側） */
export function rowEdge(l: ChartLayout, r: number) {
  const right = fromRight(r);
  const dir = right ? 1 : -1;
  // 細編みの立ち上がり鎖1目は編み地の外にあるので、その分外側
  const x = (right ? l.gridX + l.n * l.colW : l.gridX) + (l.filet ? 0 : dir * l.colW);
  const arrowX = x + dir * 6;
  const cy = rowTop(l, r) + l.rowH / 2;
  return {
    dir,
    cy,
    arrowX,
    arrow: `M${arrowX + dir * 16} ${cy}L${arrowX} ${cy}M${arrowX + dir * 5} ${cy - 3.5}L${arrowX} ${cy}L${arrowX + dir * 5} ${cy + 3.5}`,
    labelX: arrowX + dir * 21,
    anchor: (right ? "start" : "end") as "start" | "end",
  };
}

const MARGIN_SIDE = 72;
const MARGIN_TOP = 16;
const LABEL_COLOR = "#52525b";
const GUIDE_MINOR = "#ececee";
const GUIDE_MAJOR = "#c4c4c8";

/**
 * 往復編みの編み図を組み立てる。1段目は右→左。
 * 段数・矢印・立ち上がりは各段の編み始め側に置く。
 */
export function buildChart(p: ChartParams): Chart {
  const filet = p.mode === "filet";
  // 1目の幅と1段の高さ（SVG 単位）。ゲージで縦横比を補正する
  const colW = filet ? 14 : 20;
  const rowH = colW * (p.gauge.stitches / p.gauge.rows);
  // 横方向の目数（方眼編みはマスの境目の長編みを共有するので 3n+1）
  const n = filet ? p.cols * 3 + 1 : p.cols;

  const gridX = MARGIN_SIDE;
  const gridY = MARGIN_TOP;
  const gridW = n * colW;
  const gridH = p.rows * rowH;
  const chainRowH = colW * 0.8;
  const scaleY = gridY + gridH + chainRowH + 4;
  const width = gridW + MARGIN_SIDE * 2;
  const height = scaleY + 26;
  const sw = filet ? 1.3 : 1.6;
  const layout: ChartLayout = { filet, cols: p.cols, rows: p.rows, n, colW, rowH, gridX, gridY, width, height };

  const top = (r: number) => rowTop(layout, r);
  const colX = (c: number) => gridX + c * colW;
  const cell = (r: number, c: number) => p.grid[(p.rows - r) * p.cols + c];
  const tapestryInk = (idx: number) => ({ color: p.colors[idx], outline: p.outlines[idx] });
  const filetInk = tapestryInk(0);

  const guides: ReactNode[] = [];
  for (let k = 5; k < n; k += 5) {
    const x = colX(n - k);
    guides.push(<line key={`gv${k}`} x1={x} x2={x} y1={gridY} y2={gridY + gridH} stroke={k % 10 ? GUIDE_MINOR : GUIDE_MAJOR} strokeWidth={0.8} />);
  }
  for (let r = 5; r < p.rows; r += 5) {
    const y = top(r);
    guides.push(<line key={`gh${r}`} x1={gridX} x2={gridX + gridW} y1={y} y2={y} stroke={r % 10 ? GUIDE_MINOR : GUIDE_MAJOR} strokeWidth={0.8} />);
  }

  const stitches: ReactNode[] = [];
  const edges: ReactNode[] = [];
  for (let r = 1; r <= p.rows; r++) {
    const y = top(r);
    const right = fromRight(r);
    const startCol = right ? n - 1 : 0;

    for (let c = 0; c < n; c++) {
      const key = `${r}-${c}`;
      const box = { x: colX(c), y, w: colW, h: rowH, strokeWidth: sw };
      if (!filet) {
        stitches.push(<SingleCrochet key={key} {...box} {...tapestryInk(cell(r, c))} variant={p.scVariant} />);
      } else if (c === startCol) {
        // 立ち上がりの鎖3目が1目めの長編みの代わりになる
        stitches.push(<TurningChain key={key} {...box} count={3} {...filetInk} />);
      } else if (c % 3 === 0 || cell(r, Math.floor(c / 3)) === 1) {
        stitches.push(<DoubleCrochet key={key} {...box} {...filetInk} />);
      } else {
        stitches.push(<Chain key={key} {...box} h={rowH * 0.36} {...filetInk} />);
      }
    }

    // 細編みの立ち上がり鎖1目は目数に数えないので、編み地の外に置く
    if (!filet) {
      const first = cell(r, right ? p.cols - 1 : 0);
      const tx = right ? gridX + gridW : gridX - colW;
      edges.push(<TurningChain key={`t${r}`} x={tx} y={y} w={colW} h={rowH} count={1} strokeWidth={sw} {...tapestryInk(first)} />);
    }
    // 矢印は編む向きを指す（編み始め側の外から内へ）
    const edge = rowEdge(layout, r);
    edges.push(
      <path
        key={`a${r}`}
        d={edge.arrow}
        fill="none"
        stroke={LABEL_COLOR}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
    );
    if (r === 1 || r % 5 === 0) {
      edges.push(
        <text
          key={`n${r}`}
          x={edge.labelX}
          y={edge.cy}
          dominantBaseline="central"
          textAnchor={edge.anchor}
          fontSize={r % 10 === 0 ? 12 : 10}
          fontWeight={r % 10 === 0 ? 700 : 400}
          fill={r % 10 === 0 ? "#18181b" : LABEL_COLOR}
        >
          {r}
        </text>,
      );
    }
  }

  // 作り目の鎖
  const foundationInk = filet ? filetInk : tapestryInk(cell(1, p.cols - 1));
  const chainY = gridY + gridH;
  for (let c = 0; c < n; c++) {
    edges.push(<Chain key={`f${c}`} x={colX(c)} y={chainY} w={colW} h={chainRowH} strokeWidth={sw} {...foundationInk} />);
  }

  // 目数の目盛り（1段目の編み始め＝右端から数える）
  for (let k = 1; k <= n; k++) {
    if (k !== 1 && k % 10 !== 0) continue;
    const x = colX(n - k) + colW / 2;
    edges.push(
      <g key={`s${k}`}>
        <line x1={x} x2={x} y1={scaleY} y2={scaleY + 5} stroke={LABEL_COLOR} strokeWidth={1} />
        <text x={x} y={scaleY + 15} textAnchor="middle" fontSize={10} fill={LABEL_COLOR}>
          {k}
        </text>
      </g>,
    );
  }
  edges.push(
    <text key="ft" x={gridX - 6} y={chainY + chainRowH / 2} textAnchor="end" dominantBaseline="central" fontSize={9} fill={LABEL_COLOR}>
      作り目
    </text>,
  );

  const content = (
    <g fontFamily="system-ui, -apple-system, sans-serif">
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
      {guides}
      <rect x={gridX} y={gridY} width={gridW} height={gridH} fill="none" stroke={GUIDE_MAJOR} strokeWidth={0.8} />
      {stitches}
      {edges}
    </g>
  );
  return { width, height, content, layout };
}
