"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { decodeGrid, type SavedPattern, type SavedYarn, useHydrated, useSavedPatterns } from "@/lib/patterns";
import { type Yarn, YARNS } from "@/lib/yarns";
import { PageTitle } from "./Decorations";
import { PatternEditor } from "./PatternEditor";

/** 在庫にある毛糸はその情報（残量など）を使い、なければ保存時の名前と色だけで表示する */
function toYarn(s: SavedYarn): Yarn {
  return (
    YARNS.find((y) => y.id === s.id) ?? {
      ...s,
      brand: "",
      name: `${s.name}（在庫にない毛糸）`,
      remainingGrams: 0,
      hookSize: "",
      gramsPer100Sc: 0,
    }
  );
}

/** 開いた時点の編み図を手直しの元にする（保存し直しても元に戻す履歴がずれないように） */
function Editor({ pattern }: { pattern: SavedPattern }) {
  const [base] = useState(() => decodeGrid(pattern.grid));
  const [paletteIds, setPaletteIds] = useState(() => pattern.palette.map((y) => y.id));
  const palette = useMemo(
    () =>
      paletteIds.map((id) => {
        const saved = pattern.palette.find((y) => y.id === id);
        // 保存時の毛糸か、編集中に在庫から足した毛糸
        return saved ? toYarn(saved) : YARNS.find((y) => y.id === id)!;
      }),
    [paletteIds, pattern.palette],
  );

  return (
    <PatternEditor
      mode={pattern.mode}
      cols={pattern.cols}
      rows={pattern.rows}
      gauge={pattern.gauge}
      scVariant={pattern.scVariant}
      palette={palette}
      base={base}
      savedId={pattern.id}
      defaultName={pattern.name}
      initialRow={pattern.currentRow}
      onAddYarn={(id) => setPaletteIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
    />
  );
}

export function SavedPatternEditor() {
  const id = useSearchParams().get("id");
  const patterns = useSavedPatterns();
  const hydrated = useHydrated();
  const pattern = patterns.find((p) => p.id === id);

  if (!hydrated) return <p className="py-6 text-center text-sm text-muted">読み込み中…</p>;
  if (!pattern) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        編み図が見つかりません。
        <Link href="/patterns" className="text-terra-dark underline">
          保存した編み図
        </Link>
      </p>
    );
  }
  return (
    <>
      <PageTitle en="Edit" ja={pattern.name} />
      <section className="stitched rounded-[28px] bg-cream px-5 py-6 shadow-[0_2px_10px_rgb(43_42_37/0.06)]">
        <Editor key={pattern.id} pattern={pattern} />
      </section>
    </>
  );
}
