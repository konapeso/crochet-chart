import type { Metadata } from "next";
import { YarnSwatch } from "@/components/YarnSwatch";
import { YARNS } from "@/lib/yarns";

export const metadata: Metadata = { title: "毛糸の在庫" };

export default function YarnsPage() {
  const total = YARNS.reduce((s, y) => s + y.remainingGrams, 0);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4 pb-16">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">毛糸の在庫</h1>
        <p className="text-sm text-zinc-500 tabular-nums">
          {YARNS.length} 色・計 {total} g
        </p>
      </div>
      {YARNS.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">data/yarns.json に毛糸を登録してください</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {YARNS.map((y) => (
            <li key={y.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
              <YarnSwatch yarn={y} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">{y.brand}</p>
                <p className="font-semibold leading-snug">{y.name}</p>
                <p className="text-sm text-zinc-600">
                  {y.colorNumber}・{y.colorName}
                </p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-zinc-500">残量</dt>
                  <dd className="tabular-nums">
                    <span className="font-semibold">{y.remainingGrams}</span> g
                  </dd>
                  <dt className="text-zinc-500">かぎ針</dt>
                  <dd>{y.hookSize}</dd>
                  <dt className="text-zinc-500">細編み100目</dt>
                  <dd className="tabular-nums">約 {y.gramsPer100Sc} g</dd>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">在庫は data/yarns.json で管理しています。表示色は写真からの推定です。</p>
    </div>
  );
}
