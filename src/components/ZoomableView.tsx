"use client";

import { type ReactNode, type Ref, useCallback, useEffect, useImperativeHandle, useRef } from "react";

type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** なぞり塗りのコールバック（座標は SVG 上の点） */
export type PaintHandlers = {
  start: (p: Point) => void;
  move: (p: Point) => void;
  /** commit = false なら、そのひと筆を取り消す（直後に2本指のピンチが始まったとき） */
  end: (commit: boolean) => void;
};

/** 親から SVG を取り出す（画像保存用） */
export type ZoomableViewHandle = { getSvg: () => SVGSVGElement | null };

const MAX_ZOOM = 25;
/** なぞり始めてからこの時間内に2本目の指が触れたら、塗りではなくピンチとみなす */
const PINCH_GRACE_MS = 300;

/**
 * SVG の viewBox を直接書き換えてピンチズーム・パンする。
 * （CSS transform と違い拡大してもぼやけず、React の再描画も起きない）
 * paint を渡すと、1本指はなぞり塗り、2本指はピンチ・パンになる。
 */
export function ZoomableView(props: {
  width: number;
  height: number;
  children: ReactNode;
  /** 画像保存に含めない重ね描き（塗っている途中のマス、段のハイライトなど） */
  overlay?: ReactNode;
  label: string;
  paint?: PaintHandlers | null;
  /** この範囲が画面外なら、見える位置までスクロールする（段マーカー用） */
  focus?: Box | null;
  handleRef?: Ref<ZoomableViewHandle>;
}) {
  const { width, height, children, overlay, label, paint, focus } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(props.handleRef, () => ({ getSvg: () => svgRef.current }), []);
  const view = useRef<Box>({ x: 0, y: 0, w: width, h: height });
  const fitW = useRef(width);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);
  const stroke = useRef<{ startedAt: number } | null>(null);

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

  /** 画面上の点 → SVG 上の点 */
  const toSvg = (clientX: number, clientY: number): Point => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = view.current;
    const k = v.w / rect.width;
    return { x: v.x + (clientX - rect.left) * k, y: v.y + (clientY - rect.top) * k };
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

  // 段マーカーの段が画面外に出たら、拡大率はそのままで縦にスクロールして見せる
  const fx = focus?.x, fy = focus?.y, fw = focus?.w, fh = focus?.h;
  useEffect(() => {
    if (fy === undefined || fh === undefined || fx === undefined || fw === undefined) return;
    const v = view.current;
    const margin = fh;
    if (fy - margin < v.y || fy + fh + margin > v.y + v.h) v.y = fy + fh / 2 - v.h / 2;
    if (fw < v.w && (fx < v.x || fx + fw > v.x + v.w)) v.x = fx + fw / 2 - v.w / 2;
    apply();
  }, [fx, fy, fw, fh, apply]);

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const endStroke = (commit: boolean) => {
    if (!stroke.current) return;
    stroke.current = null;
    paint?.end(commit);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ポインタがすでに離れている場合は無視
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && paint) {
      stroke.current = { startedAt: performance.now() };
      paint.start(toSvg(e.clientX, e.clientY));
    } else if (pointers.current.size === 2) {
      // 塗り始めてすぐの2本目の指はピンチの始まり（1本目で塗ったマスは取り消す）
      if (stroke.current) endStroke(performance.now() - stroke.current.startedAt > PINCH_GRACE_MS);
      pinch.current = pinchState();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 1) {
      if (stroke.current) {
        paint?.move(toSvg(cur.x, cur.y));
        return;
      }
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

  const onPointerEnd = (e: React.PointerEvent, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) endStroke(!cancelled);
    pinch.current = pointers.current.size === 2 ? pinchState() : null;
  };

  const btn = "flex h-11 min-w-11 items-center justify-center rounded-lg bg-zinc-100 px-3 text-lg text-zinc-800 active:bg-zinc-200";

  return (
    <div className="space-y-2">
      <div
        className="relative w-full overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200"
        // 編み図の縦横比に合わせた高さ（スマホで余白だらけにならないよう）。aspect-ratio + min-height は横幅を押し広げるので使わない
        style={{ height: `min(70svh, max(18rem, ${((height / width) * 100).toFixed(2)}vw))` }}
      >
        <div
          ref={wrapRef}
          className={`h-full w-full touch-none select-none ${paint ? "cursor-crosshair" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerEnd(e, false)}
          onPointerCancel={(e) => onPointerEnd(e, true)}
          onDoubleClick={paint ? undefined : fit}
        >
          <svg ref={svgRef} role="img" aria-label={label} className="block h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            {children}
            {overlay && <g data-export-exclude="">{overlay}</g>}
          </svg>
        </div>
      </div>
      {/* ボタンは編み図の外に置く（端の段数・矢印を隠さないように） */}
      <div className="flex justify-end gap-2">
        <button type="button" className={btn} aria-label="縮小" onClick={() => zoomCenter(1 / 1.5)}>
          −
        </button>
        <button type="button" className={btn} aria-label="拡大" onClick={() => zoomCenter(1.5)}>
          ＋
        </button>
        <button type="button" className={`${btn} text-sm`} aria-label="全体表示" onClick={fit}>
          全体
        </button>
      </div>
    </div>
  );
}
