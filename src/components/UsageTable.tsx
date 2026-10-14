import type { Mode } from "@/lib/pattern";
import { type ColorUsage, gramsNeeded } from "@/lib/usage";
import { type Yarn, yarnLabel } from "@/lib/yarns";
import { ShortageBadge, YarnSwatch } from "./YarnSwatch";

export const fmtG = (g: number) => (g < 10 ? g.toFixed(1) : Math.ceil(g).toString());

/** 色ごとの目数集計と必要量。残量が足りない毛糸には「不足」 */
export function UsageTable({ mode, palette, usage }: { mode: Mode; palette: Yarn[]; usage: ColorUsage[] }) {
  const filet = mode === "filet";
  const rows = usage.filter((u) => u.sc + u.dc + u.chains > 0);
  const totalStitches = rows.reduce((s, u) => s + (filet ? u.dc : u.sc), 0);

  return (
    <div>
      <ul className="divide-y divide-line/60">
        {rows.map((u) => {
          const yarn = palette[u.index];
          const need = gramsNeeded(u.scEquivalent, yarn.gramsPer100Sc);
          const short = need > yarn.remainingGrams;
          return (
            <li key={yarn.id} className="flex items-center gap-3 py-2.5">
              <YarnSwatch yarn={yarn} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-sm font-medium">{yarnLabel(yarn)}</span>
                  {short && <ShortageBadge />}
                </div>
                <div className="text-xs text-muted tabular-nums">
                  {filet ? `長編み ${u.dc} 目` : `細編み ${u.sc} 目`}
                  {!filet && totalStitches > 0 && `（${Math.round((u.sc / totalStitches) * 100)}%）`}
                  {u.chains > 0 && ` ＋ 鎖 ${u.chains} 目`}
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className={`text-sm font-semibold ${short ? "text-terra-dark" : ""}`}>{fmtG(need)} g</div>
                <div className="text-xs text-muted">残 {yarn.remainingGrams} g</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        必要量は目安です（細編み100目あたりの使用量から換算。長編み1目＝細編み2目、鎖1目＝細編み0.5目として計算）。
        {!filet && "編み込みで裏に渡す糸の分は含みません。"}
      </p>
    </div>
  );
}
