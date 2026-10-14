# Crochet Chart Maker

Next.js (App Router / TypeScript / Tailwind CSS) で作るかぎ針編み図メーカー。
`output: "export"` の静的サイトとしてビルドし、`master` への push で Vercel にデプロイする。

## 開発

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 静的ファイルを out/ に出力
npm run lint
```

## 運用

- `master` に直接 push しない。作業ごとに `feature/<内容>` ブランチを切り、PR を出してマージする。
- `master` へのマージで Vercel が本番デプロイ、PR ごとに Preview デプロイが作られる。

## 機能

- 写真（カメラ撮影 / 写真選択）からマス目化し、かぎ針編みの編み図（JIS 記号・SVG）を作る
- 細編みの編み込み（カラー）: パレットへ減色（Lab / CIEDE2000、ディザリング切替）
- 方眼編み（単色）: しきい値で2値化。埋まったマス＝長編み3目、空きマス＝長編み1目＋鎖2目
- 往復編みの段数・矢印・立ち上がり、作り目、目盛り、凡例と配色表、ピンチズーム
- 毛糸の在庫（`/yarns`）。編み図の配色は在庫の毛糸から選び、色ごとの必要量と不足を表示

## 毛糸の在庫データ（`data/yarns.json`）

配列で管理する。ビルド時に形を検証し、壊れていればビルドが止まる。

| キー | 内容 | 例 |
| --- | --- | --- |
| `id` | 一意な ID | `"daily-wool-blend-6"` |
| `brand` | ブランド | `"ダイソー"` |
| `name` | 品名 | `"デイリーウールブレンド〈並太〉"` |
| `colorNumber` | 色番号 | `"6"` |
| `colorName` | 色名 | `"ブルーグリーン"` |
| `hex` | 表示色（写真からの推定） | `"#4a6e70"` |
| `remainingGrams` | 残量 (g) | `70` |
| `hookSize` | 推奨かぎ針号数 | `"5/0〜6/0号"` |
| `gramsPer100Sc` | 細編み100目あたりの使用量 (g) | `3.5` |

必要量は `細編み換算の目数 / 100 × gramsPer100Sc`。長編み1目＝細編み2目、鎖1目＝細編み0.5目として換算する。
