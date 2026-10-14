import type { Metadata, Viewport } from "next";
import { Tilt_Warp, Zen_Kaku_Gothic_Antique } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const zenKaku = Zen_Kaku_Gothic_Antique({
  variable: "--font-zen-kaku",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const tiltWarp = Tilt_Warp({
  variable: "--font-tilt-warp",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Crochet Chart Maker", template: "%s | Crochet Chart Maker" },
  description: "写真からかぎ針編みの編み図を作る",
};

export const viewport: Viewport = {
  themeColor: "#e7e4d6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${zenKaku.variable} ${tiltWarp.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
