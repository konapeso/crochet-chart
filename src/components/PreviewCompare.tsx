"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SourceImage } from "@/lib/image";
import { clampRect, type Mode, type Rect } from "@/lib/pattern";

const PREVIEW_W = 480;

/** 元写真（切り抜き範囲）と仕上がりイメージを並べて表示する */
export function PreviewCompare(props: {
  source: SourceImage;
  crop: Rect;
  mode: Mode;
  cols: number;
  rows: number;
  grid: Uint8Array;
  colors: string[];
  /** 仕上がりイメージの背景（白い糸の方眼編みは暗い背景で見せる） */
  backdrop: string;
  /** 元の写真をドラッグして切り抜き範囲を動かしたとき（指を離したときに1回） */
  onCropMove: (crop: Rect) => void;
}) {
  const { source, crop, mode, cols, rows, grid, colors, backdrop, onCropMove } = props;
  const photoRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const height = Math.max(1, Math.round((PREVIEW_W * crop.h) / crop.w));

  const drawPhoto = useCallback(
    (r: Rect) => {
      const ctx = photoRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source.canvas, r.x, r.y, r.w, r.h, 0, 0, PREVIEW_W, height);
    },
    [source, height],
  );

  useEffect(() => drawPhoto(crop), [drawPhoto, crop]);

  // ドラッグ中は写真だけ描き直し、編み図の再計算は指を離したときに行う（iPhone で重くならないように）
  const dragTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return null;
    const k = crop.w / e.currentTarget.clientWidth;
    return clampRect({ ...crop, x: crop.x - (e.clientX - d.x) * k, y: crop.y - (e.clientY - d.y) * k }, source.width, source.height);
  };

  useEffect(() => {
    const ctx = resultRef.current?.getContext("2d");
    if (!ctx) return;
    const cw = PREVIEW_W / cols;
    const ch = height / rows;
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, PREVIEW_W, height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = grid[r * cols + c];
        if (mode === "filet" && v === 0) continue;
        ctx.fillStyle = colors[mode === "filet" ? 0 : v];
        // 隣のマスと隙間ができないよう整数座標に丸める
        const x0 = Math.round(c * cw);
        const y0 = Math.round(r * ch);
        ctx.fillRect(x0, y0, Math.round((c + 1) * cw) - x0, Math.round((r + 1) * ch) - y0);
      }
    }
    if (mode === "filet") {
      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const x = Math.round(c * cw) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let r = 0; r <= rows; r++) {
        const y = Math.round(r * ch) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(PREVIEW_W, y);
      }
      ctx.stroke();
    }
  }, [mode, cols, rows, grid, colors, backdrop, height]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <figure>
        <canvas
          ref={photoRef}
          width={PREVIEW_W}
          height={height}
          className="h-auto w-full cursor-grab touch-none rounded-lg ring-1 ring-zinc-200 active:cursor-grabbing"
          aria-label="元の写真（ドラッグで範囲を移動）"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            const r = dragTo(e);
            if (r) drawPhoto(r);
          }}
          onPointerUp={(e) => {
            const r = dragTo(e);
            drag.current = null;
            if (r && (r.x !== crop.x || r.y !== crop.y)) onCropMove(r);
          }}
          onPointerCancel={() => {
            drag.current = null;
            drawPhoto(crop);
          }}
        />
        <figcaption className="mt-1 text-center text-xs text-zinc-500">元の写真（ドラッグで移動）</figcaption>
      </figure>
      <figure>
        <canvas ref={resultRef} width={PREVIEW_W} height={height} className="h-auto w-full rounded-lg ring-1 ring-zinc-200" />
        <figcaption className="mt-1 text-center text-xs text-zinc-500">仕上がりイメージ</figcaption>
      </figure>
    </div>
  );
}
