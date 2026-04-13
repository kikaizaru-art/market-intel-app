# Market Intel App

## ビジョン

対象（アプリ・人物・企業など）の情報と周辺環境を整理し、**今の立ち位置・過去の推移・次の一手** を導くインテリジェンスツール。

- **現在地の把握**: 対象と周辺環境（市場・競合・ユーザー）を一画面で整理
- **推移の確認**: 過去からどう変わったか、何がきっかけで変動したかを因果付きで振り返る
- **次の一手の予測**: 蓄積した因果パターンから成功確率の高いアクションを提示

詳細: `docs/vision.md`

## デプロイ

- GitHub Pages URL: https://kikaizaru-art.github.io/market-intel-app/
- **デプロイ方式**: GitHub Actions (`actions/deploy-pages`) — master push で自動デプロイ
- **Vite base path**: `./` (相対パス — GitHub Pages / Vercel 両対応)

## 開発

- `npm run dev` — ローカル開発サーバー (port 5173)
- `npm run build` — プロダクションビルド (dist/)
- `npm run collect` — 実データ収集 (Google Trends, Google Play, RSS, Meta Ads)

## アーキテクチャ

- `src/dashboard/constants.js` — 共有定数 (カラーパレット, ラベル)
- `src/dashboard/utils.js` — 共有ユーティリティ (formatDate, isActive)
- `src/dashboard/components/shared/` — 共通UIコンポーネント (ChartTooltip, SentimentBar)
- `src/dashboard/components/appinfo/` — AppInfoView のタブ分割コンポーネント
- `src/collectors/` — データ収集モジュール (trends, store, news, meta-ads)
- `src/analyzers/` — 分析ロジック (trend, anomaly, causation)
- `src/framework/` — マルチドメインフレームワーク (domain, layers, collector-registry, causal-engine)

## 4層収集モデル

対象の周辺環境を4つのレイヤーで多層的に収集し、因果関係を蓄積・学習する。

- **L1 マクロ**: 市場全体の追い風・逆風 (トレンド、業界ニュース)
- **L2 競合**: ライバルの動き (順位、レビュー、広告出稿)
- **L3 ユーザー**: 自分のユーザーの声と行動 (レビュー、SNSセンチメント)
- **L4 因果**: 「こうしたらこうなった」の学習エンジン (自動蓄積・検証・信頼度更新)
- **ドメイン設定**: `config/domains/{domain}.json` で対象を定義。切替で同じ構造が動く
- **ドメイン切替**: ダッシュボードUIでドメイン選択可能 / `DOMAIN=stock npm run collect` でCLI切替
- 詳細設計: `docs/architecture.md`

## データフロー

1. `npm run collect` → `data/` に個別JSON + `public/data/collected.json` に統合出力
2. ダッシュボード起動時に `collected.json` を fetch
3. 実データがあれば上書き、なければ `generateData.js` のモックを使用

## 次の実装課題 (優先順)

1. **因果ログの永続化** — 手動メモ・自動メモが React state のみで消える (`CausationView.jsx`)
2. **自動検証の循環論法修正** — `autoMemo.js` の `validateAnomalyEvent`/`validateNewsCorrelation` が自己承認
3. **文脈入力UI** — 自動検出に対してワンタップ選択肢+メモ+自由記帳で因果文脈を付与
4. **ダッシュボード3タブ再構成** — 現行(アプリ情報/ユーザー/業界) → ビジョン(現在地/推移/次の一手)
5. **インフルエンサードメイン設計** — メインユースケースだが config/collectors ともに未着手

詳細: `docs/vision.md` の「既知の課題と次のアクション」
