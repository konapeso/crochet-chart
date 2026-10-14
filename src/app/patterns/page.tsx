import type { Metadata } from "next";
import { SavedPatternList } from "@/components/SavedPatternList";

export const metadata: Metadata = { title: "保存した編み図" };

export default function PatternsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4 pb-16">
      <h1 className="text-xl font-bold">保存した編み図</h1>
      <SavedPatternList />
      <p className="text-xs text-zinc-500">この端末のブラウザに保存しています。ブラウザのデータを消すと消えます。</p>
    </div>
  );
}
