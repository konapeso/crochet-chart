"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";

type Box = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

const MAX_ZOOM = 25;

/**
 * SVG の viewBox を直接書き換えてピンチズーム・パンする。
 * （CSS transform と違い拡大してもぼやけず、React の再描画も起きない）
 */
export function ZoomableView({ width, height, children, label }: { width: number; height: number; children: ReactNode; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const view = useRef<Box>({ x: 0, y: 0, w: width, h: height });
  const fitW = useRef(width);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);

  const apply = useCallback(() => {
    const v = view.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  }, []);

  /** 画面の縦横比に合わせた viewBox で全体を表示する */
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return;
    const aspect = el.clientHeight / el.clientWidth;
    let w = width;
    let h = width * aspect;
    if (h < height) {
      h = height;
      w = height / aspect;
    }
    fitW.current = w;
    view.current = { x: (width - w) / 2, y: (height - h) / 2, w, h };
    apply();
  }, [width, height, apply]);

  /** 画面上の点 (clientX, clientY) を中心に factor 倍に拡大する */
  const zoomAt = useCallback(
    (factor: number, client: Point, moveTo: Point = client) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const v = view.current;
      const k = v.w / rect.width;
      const anchor = { x: v.x + (client.x - rect.left) * k, y: v.y + (client.y - rect.top) * k };
      const w = Math.min(fitW.current * 1.5, Math.max(fitW.current / MAX_ZOOM, v.w / factor));
      const h = (w * rect.height) / rect.width;
      const nk = w / rect.width;
      view.current = { x: anchor.x - (moveTo.x - rect.left) * nk, y: anchor.y - (moveTo.y - rect.top) * nk, w, h };
      apply();
    },
    [apply],
  );

  const zoomCenter = (factor: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) zoomAt(factor, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  useEffect(() => {
    fit();
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), { x: e.clientX, y: e.clientY });
    };
    // iOS Safari のページ全体のピンチズームを抑止
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", stop);
    el.addEventListener("gesturechange", stop);
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("gesturechange", stop);
    };
  }, [fit, zoomAt]);

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ポインタがすでに離れている場合は無視
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = pointers.current.size === 2 ? pinchState() : null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 1) {
      const el = wrapRef.current;
      if (!el) return;
      const k = view.current.w / el.clientWidth;
      view.current.x -= (cur.x - prev.x) * k;
      view.current.y -= (cur.y - prev.y) * k;
      apply();
    } else if (pointers.current.size === 2 && pinch.current) {
      const next = pinchState();
      zoomAt(next.dist / pinch.current.dist, pinch.current.mid, next.mid);
      pinch.current = next;
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = pointers.current.size === 2 ? pinchState() : null;
  };

  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl text-zinc-800 shadow ring-1 ring-zinc-300 active:bg-zinc-100";

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200"
      // 編み図の縦横比に合わせた高さ（スマホで余白だらけにならないよう）。aspect-ratio + min-height は横幅を押し広げるので使わない
      style={{ height: `min(70svh, max(18rem, ${((height / width) * 100).toFixed(2)}vw))` }}
    >
      <div
        ref={wrapRef}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={fit}
      >
        <svg ref={svgRef} role="img" aria-label={label} className="block h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {children}
        </svg>
      </div>
      <div className="absolute right-3 bottom-3 flex flex-col gap-2">
        <button type="button" className={btn} aria-label="拡大" onClick={() => zoomCenter(1.5)}>
          ＋
        </button>
        <button type="button" className={btn} aria-label="縮小" onClick={() => zoomCenter(1 / 1.5)}>
          −
        </button>
        <button type="button" className={`${btn} text-xs font-medium`} aria-label="全体表示" onClick={fit}>
          全体
        </button>
      </div>
    </div>
  );
}
