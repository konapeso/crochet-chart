import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SavedPatternEditor } from "@/components/SavedPatternEditor";

export const metadata: Metadata = { title: "編み図を編集" };

export default function EditPatternPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4 pb-16">
      <Link href="/patterns" className="inline-flex min-h-11 items-center text-sm text-rose-700">
        ← 保存した編み図
      </Link>
      {/* ?id= を読むので、静的書き出しではこの中だけブラウザで描画する */}
      <Suspense fallback={<p className="py-6 text-center text-sm text-zinc-500">読み込み中…</p>}>
        <SavedPatternEditor />
      </Suspense>
    </div>
  );
}
