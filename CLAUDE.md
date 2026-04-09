# Market Intel App

## デプロイ

- GitHub Pages URL: https://kikaizaru-art.github.io/market-intel-app/
- デプロイ方式: GitHub Actions (`actions/deploy-pages`) — master push で自動デプロイ
- Vite base path: `/market-intel-app/`

## 開発

- `npm run dev` — ローカル開発サーバー (port 5173)
- `npm run build` — プロダクションビルド (dist/)
- `npm run collect` — データ収集 (Phase 2)

## Git ルール

- コード変更時は必ずfeatureブランチを切ってから作業する（masterに直接コミットしない）
- ブランチ名の例: `feat/パネル名`, `fix/修正内容`
