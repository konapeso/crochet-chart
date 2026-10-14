"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePattern, useHydrated, useSavedPatterns } from "@/lib/patterns";

const MODE_LABEL = { tapestry: "細編みの編み込み", filet: "方眼編み" } as const;

export function SavedPatternList() {
  const patterns = useSavedPatterns();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) return <p className="py-6 text-center text-sm text-muted">読み込み中…</p>;
  if (patterns.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        保存した編み図はまだありません。
        <Link href="/" className="text-terra-dark underline">
          編み図を作る
        </Link>
      </p>
    );
  }

  return (
    <>
      {error && <p className="text-sm text-terra-dark">{error}</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {patterns.map((p) => (
          <li key={p.id} className="stitched flex gap-3 rounded-[24px] bg-cream p-4 shadow-[0_2px_10px_rgb(43_42_37/0.06)]">
            <Link href={`/patterns/edit?id=${encodeURIComponent(p.id)}`} className="shrink-0">
              {p.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- 端末内に保存した data URL
                <img src={p.thumbnail} alt="" className="h-24 w-24 rounded-xl bg-white object-contain ring-1 ring-line [image-rendering:pixelated]" />
              ) : (
                <span className="block h-24 w-24 rounded-xl bg-oat" />
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/patterns/edit?id=${encodeURIComponent(p.id)}`} className="truncate font-semibold">
                {p.name}
              </Link>
              <p className="text-xs text-muted">
                {MODE_LABEL[p.mode]}・{p.cols} × {p.rows} 段
              </p>
              <p className="text-xs text-muted tabular-nums">
                {new Date(p.updatedAt).toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              {p.currentRow > 0 && (
                <p className="mt-0.5 text-xs font-medium text-muted tabular-nums">
                  {p.currentRow} / {p.rows} 段目まで
                </p>
              )}
              <div className="mt-auto flex gap-2 pt-2">
                <Link
                  href={`/patterns/edit?id=${encodeURIComponent(p.id)}`}
                  className="btn-pill min-h-11 flex-1 bg-mustard text-sm text-ink active:bg-mustard-dark"
                >
                  開く
                </Link>
                <button
                  type="button"
                  className="min-h-11 rounded-full border-[1.5px] border-ink/70 bg-cream px-4 text-sm font-bold text-ink active:bg-oat"
                  onClick={() => {
                    if (!confirm(`「${p.name}」を削除しますか？`)) return;
                    try {
                      deletePattern(p.id);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "削除できませんでした");
                    }
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
