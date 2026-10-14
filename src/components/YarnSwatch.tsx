import type { Yarn } from "@/lib/yarns";

export function YarnSwatch({ yarn, size = 20 }: { yarn: Yarn; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full ring-1 ring-black/15"
      style={{ background: yarn.hex, width: size, height: size }}
      aria-hidden
    />
  );
}

export function ShortageBadge() {
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-red-700">不足</span>;
}
