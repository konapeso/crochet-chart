import yarnsData from "../../data/yarns.json";

/** data/yarns.json の1件 */
export type Yarn = {
  id: string;
  /** ブランド（メーカー・販売元） */
  brand: string;
  /** 品名 */
  name: string;
  /** 色番号 */
  colorNumber: string;
  /** 色名 */
  colorName: string;
  /** 表示色 #rrggbb */
  hex: string;
  /** 残量 (g) */
  remainingGrams: number;
  /** 推奨かぎ針号数（例: "5/0〜6/0号"） */
  hookSize: string;
  /** 細編み100目あたりの使用量 (g) */
  gramsPer100Sc: number;
};

function fail(i: number, field: string, why: string): never {
  throw new Error(`data/yarns.json [${i}].${field}: ${why}`);
}

/** JSON の形をビルド時に検証する（壊れていたらビルドが止まる） */
function validate(data: unknown): Yarn[] {
  if (!Array.isArray(data)) throw new Error("data/yarns.json: 配列ではありません");
  const ids = new Set<string>();
  return data.map((y: Record<string, unknown>, i) => {
    for (const f of ["id", "brand", "name", "colorNumber", "colorName", "hookSize"] as const) {
      if (typeof y[f] !== "string") fail(i, f, "文字列ではありません");
    }
    if (typeof y.hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(y.hex)) fail(i, "hex", "#rrggbb 形式ではありません");
    for (const f of ["remainingGrams", "gramsPer100Sc"] as const) {
      if (typeof y[f] !== "number" || !(y[f] >= 0)) fail(i, f, "0 以上の数値ではありません");
    }
    if (ids.has(y.id as string)) fail(i, "id", `重複しています (${y.id})`);
    ids.add(y.id as string);
    return y as Yarn;
  });
}

export const YARNS: Yarn[] = validate(yarnsData);

export function yarnLabel(y: Yarn): string {
  return `${y.name} ${y.colorNumber}`;
}
