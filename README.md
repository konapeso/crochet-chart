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
