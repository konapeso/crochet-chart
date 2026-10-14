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
