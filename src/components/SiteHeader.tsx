"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { YarnBall } from "./Decorations";

const NAV = [
  { href: "/", label: "作る" },
  { href: "/patterns", label: "保存済み" },
  { href: "/yarns", label: "毛糸" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <YarnBall size={30} className="shrink-0" />
          <span className="truncate font-display text-lg leading-none sm:text-xl">Crochet Chart</span>
        </Link>
        <nav className="flex shrink-0 gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full px-3 text-sm font-bold ${
                  active ? "border-[1.5px] border-ink bg-mustard text-ink" : "text-muted"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
