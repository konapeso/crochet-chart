import type { Metadata } from "next";
import { PageTitle, YarnBall } from "@/components/Decorations";
import { YARNS } from "@/lib/yarns";

export const metadata: Metadata = { title: "毛糸の在庫" };

export default function YarnsPage() {
  const total = YARNS.reduce((s, y) => s + y.remainingGrams, 0);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4 pb-16">
      <PageTitle
        en="Yarns"
        ja="毛糸の在庫"
        aside={
          <p className="text-sm text-muted tabular-nums">
            {YARNS.length} 色・計 {total} g
          </p>
        }
      />
      {YARNS.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">data/yarns.json に毛糸を登録してください</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {YARNS.map((y) => (
            <li key={y.id} className="stitched flex gap-4 rounded-[24px] bg-cream p-5 shadow-[0_2px_10px_rgb(43_42_37/0.06)]">
              <YarnBall size={60} color={y.hex} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{y.brand}</p>
                <p className="font-bold leading-snug">{y.name}</p>
                <p className="text-sm text-muted">
                  {y.colorNumber}・{y.colorName}
                </p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">残量</dt>
                  <dd className="tabular-nums">
                    <span className="font-semibold">{y.remainingGrams}</span> g
                  </dd>
                  <dt className="text-muted">かぎ針</dt>
                  <dd>{y.hookSize}</dd>
                  <dt className="text-muted">細編み100目</dt>
                  <dd className="tabular-nums">約 {y.gramsPer100Sc} g</dd>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">在庫は data/yarns.json で管理しています。表示色は目安です。</p>
    </div>
  );
}
