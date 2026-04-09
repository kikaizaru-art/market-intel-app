# Market Intel App

## デプロイ

- 本番 (GitHub Pages): https://kikaizaru-art.github.io/market-intel-app/
  - デプロイ方式: GitHub Actions (`actions/deploy-pages`) — master push で自動デプロイ
- プレビュー (Vercel): featureブランチへのpushで自動生成
  - PRにVercel botがプレビューURLをコメント
- Vite base path: GitHub Pages=`/market-intel-app/`, Vercel=`/` (環境変数で自動切替)

## 開発

- `npm run dev` — ローカル開発サーバー (port 5173)
- `npm run build` — プロダクションビルド (dist/)
- `npm run collect` — データ収集 (Phase 2)

## Git ルール

- コード変更時は必ずfeatureブランチを切ってから作業する（masterに直接コミットしない）
- ブランチ名の例: `feat/パネル名`, `fix/修正内容`

## 開発フロー

1. featureブランチを切って作業
2. pushするとVercelがプレビューURLを自動生成
3. スマホで確認
4. OKならPRを出してmasterにマージ → GitHub Pagesに本番デプロイ
