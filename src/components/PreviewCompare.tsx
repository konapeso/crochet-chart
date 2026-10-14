"use client";

import { useEffect, useRef } from "react";
import type { SourceImage } from "@/lib/image";
import type { Mode, Rect } from "@/lib/pattern";
import { FILET_INK } from "@/lib/palette";

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
}) {
  const { source, crop, mode, cols, rows, grid, colors } = props;
  const photoRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLCanvasElement>(null);
  const height = Math.max(1, Math.round((PREVIEW_W * crop.h) / crop.w));

  useEffect(() => {
    const ctx = photoRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, PREVIEW_W, height);
  }, [source, crop, height]);

  useEffect(() => {
    const ctx = resultRef.current?.getContext("2d");
    if (!ctx) return;
    const cw = PREVIEW_W / cols;
    const ch = height / rows;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PREVIEW_W, height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = grid[r * cols + c];
        if (mode === "filet" && v === 0) continue;
        ctx.fillStyle = mode === "filet" ? FILET_INK : colors[v];
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
  }, [mode, cols, rows, grid, colors, height]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <figure>
        <canvas ref={photoRef} width={PREVIEW_W} height={height} className="h-auto w-full rounded-lg ring-1 ring-zinc-200" />
        <figcaption className="mt-1 text-center text-xs text-zinc-500">元の写真</figcaption>
      </figure>
      <figure>
        <canvas ref={resultRef} width={PREVIEW_W} height={height} className="h-auto w-full rounded-lg ring-1 ring-zinc-200" />
        <figcaption className="mt-1 text-center text-xs text-zinc-500">仕上がりイメージ</figcaption>
      </figure>
    </div>
  );
}
