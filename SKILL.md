---
name: market-intel-app
description: |
  ゲームアプリ・株式・競馬・インフルエンサーなど任意の対象について「現在地・推移・次の一手」を導く
  マルチドメイン市場インテリジェンスツール「Market Intel」の設計・実装相談。
  以下のキーワードや話題が出たときに発動:
  市場分析 / 競合分析 / 因果ログ / 因果学習 / 4層モデル (L1マクロ/L2競合/L3ユーザー/L4因果) /
  Google Trends / Google Play レビュー / Nitter / Twitter RSS / YouTube Data API /
  Ollama ローカルLLM / 因果メモ / 施策効果 / 純効果 / 市場補正 / 推奨アクション /
  IndexedDB 永続化 / ドメイン切替 / メメントモリ / 放置RPG / ガチャ / アプデ / マーケ施策 /
  React + Vite + Recharts / GitHub Pages / GitHub Actions 定期収集 /
  Sensor Tower / Brandwatch / Exploding Topics の代替 / Perplexity や ChatGPT との差別化 /
  market-intel-app / kikaizaru-art。
  データ収集アーキテクチャ、因果学習設計、ドメイン設計、ダッシュボードUXの議論相手として参加する。
---

# Market Intel App

## プロジェクトの目的

**対象（アプリ・人物・企業・馬・銘柄など）の情報と周辺環境を整理し、「今の立ち位置・過去の推移・次の一手」を導くインテリジェンスツール。**

既存ツール (Sensor Tower, Brandwatch, TradingView 等) は各層の専業で、L1〜L4 を統合するツールは空白地帯。AI 検索 (ChatGPT / Perplexity) はステートレスで過去の施策や時系列を知らない。Market Intel は **ステートフルに因果ログを蓄積し続けることで使うほど賢くなる** 点で差別化する。蓄積されるデータこそが本質的な価値で、後から LLM を差し替えても蓄積は残る、という設計思想。

## 現在のフェーズ

Phase 3.5 (ビジョン再定義 + ダッシュボード再構成) を超え、Phase 4 (因果学習エンジン基盤) はほぼ完了。現状の主要機能:

- 4層モデルの実データ収集 (Trends / Google Play / Ranking / Reddit / News RSS / YouTube Data API / Twitter-via-Nitter) が稼働し、GitHub Actions で JST 7:00 に毎日自動収集
- ダッシュボードは **現在地 / 推移 / 次の一手** の3タブ + ドメイン切替 UI
- 因果ログは IndexedDB に永続化 (インメモリキャッシュ + localStorage からの自動移行)
- Ollama ローカル LLM 統合済み (因果サマリー生成・季節要因分析、未接続時はテンプレートフォールバック)
- 施策記録 UI (プロダクト / マーケ 2レーン、媒体 + 地域タグ)、施策マーカーの HistoryView オーバレイ、推奨アクションの Evidence Drill-Down まで実装済み
- 施策効果は **市場補正後の純効果** (競合アプリや他ジャンルの同時期 baseline を差し引き) で評価
- 本運用ドメイン: `memento-mori` (放置RPG)、`influencer`。設計のみ: `game-market`, `keiba`, `stock`

CLAUDE.md の「次の実装課題」は 1〜18 まで全て完了。次は競合広告動向 (Meta Ad Library / TikTok Creative Center) の実装、ドメイン拡充 (株式・競馬の実装昇格)、因果学習エンジンの精度向上が候補。

## 技術スタック・使用ツール

- **フロント**: React 18 + Vite 5 + Recharts 2 (SPA, GitHub Pages ホスティング)
- **ストレージ**: IndexedDB (`storageBackend.js` 経由) — 因果ログ・パターン学習・LLM設定を永続化
- **LLM**: Ollama (localhost:11434) — llama3.2 / gemma2 等、プロバイダー抽象化済み
- **コレクター (Node.js)**: `google-play-scraper`, `rss-parser`, YouTube Data API v3, Nitter RSS
- **CI/CD**: GitHub Actions (`collect.yml` 毎日収集, `deploy.yml` master push で GitHub Pages 自動デプロイ, `ci.yml` ビルド検証)
- **Vite base path**: `./` (GitHub Pages / Vercel 両対応)
- **依存は極小構成** (devDeps は Vite とプラグインのみ)

## リポジトリ構成

- `/home/user/market-intel-app/CLAUDE.md` — プロジェクト規約・アーキテクチャサマリ・実装済み課題一覧
- `/home/user/market-intel-app/docs/vision.md` — ビジョン、3つのコア機能、4層モデル、既存ツール/AI検索との差別化、既知の課題
- `/home/user/market-intel-app/docs/architecture.md` — マルチドメインフレームワーク設計、データモデル、拡張手順
- `/home/user/market-intel-app/docs/data-density-backlog.md` — データ情報量改善バックログ (大半完了済み)
- `/home/user/market-intel-app/config/targets.json` — 主要ターゲット定義
- `/home/user/market-intel-app/config/domains/` — ドメイン設定 (`memento-mori.json`, `influencer.json`, `game-market.json`, `keiba.json`, `stock.json`)
- `/home/user/market-intel-app/src/collectors/` — データ収集モジュール (`trends.js`, `store.js`, `store-ranking.js`, `community.js`, `news.js`, `youtube-channels.js`, `twitter.js`, `app-discover.js`, `competitor-discovery.js`, `social-stats.js`, `index.js` エントリ)
- `/home/user/market-intel-app/src/analyzers/` — 分析ロジック (`anomaly.js` Z-score異常値, `trend.js` 移動平均, `causation.js` 時間近接, `autoMemo.js` パターン検出, `llmAnalyzer.js` LLMサマリー, `actionRecommender.js` 純効果集計)
- `/home/user/market-intel-app/src/framework/` — ドメイン非依存フレームワーク (`domain.js`, `layers.js`, `collector-registry.js`, `causal-engine.js`)
- `/home/user/market-intel-app/src/dashboard/App.jsx` — ダッシュボードルート
- `/home/user/market-intel-app/src/dashboard/components/PositionView.jsx` — 現在地タブ
- `/home/user/market-intel-app/src/dashboard/components/HistoryView.jsx` — 推移タブ (施策マーカーオーバレイ付き)
- `/home/user/market-intel-app/src/dashboard/components/ActionsView.jsx` — 次の一手タブ (QuickRecordPanel + RecommendedActions + CausationView 折りたたみ)
- `/home/user/market-intel-app/src/dashboard/components/RecommendedActions.jsx` — 推奨アクションの UI (集計軸切替 + Evidence Drill-Down)
- `/home/user/market-intel-app/src/dashboard/components/QuickRecordPanel.jsx`, `EventQuickInput.jsx`, `CausationView.jsx` — 施策記録系
- `/home/user/market-intel-app/src/dashboard/components/LlmSettings.jsx` — Ollama 接続設定
- `/home/user/market-intel-app/src/dashboard/services/patternStore.js` — 因果ログストア (API: `saveCausalNote`/`deleteCausalNote`/`updateCausalNote` 等)
- `/home/user/market-intel-app/src/dashboard/services/storageBackend.js` — IndexedDB 層
- `/home/user/market-intel-app/src/dashboard/services/llmService.js` — LLM プロバイダー抽象化
- `/home/user/market-intel-app/src/dashboard/services/generateData.js` — 実データ欠損時のモックフォールバック
- `/home/user/market-intel-app/public/data/collected.json` — 最新の統合データ (起動時 fetch される)
- `/home/user/market-intel-app/data/history/{domain}.json` — 履歴蓄積 (reviews 月次12ヶ月, trends 週次52週, ranking 日次90日, community 日次30日, youtubeChannels 週次26週, twitter 日次30日)
- `/home/user/market-intel-app/.github/workflows/` — `ci.yml`, `collect.yml` (毎日収集), `deploy.yml` (GitHub Pages)

## Claudeに期待する役割

- **議論の相棒**: 新機能案 (例: 競合広告動向監視 / 株式・競馬ドメインの実装昇格 / LLM 活用の深堀り) について「4層モデルのどこに位置づけるか」「ドメイン非依存で書けるか」を一緒に整理する
- **因果学習エンジンの番人**: 自動検証の循環論法 (検出と検証を同じデータでやらない) や「施策効果 vs 市場追い風」の分離といったこのツールの思想を守る視点でレビューする
- **ドメイン設計のサポート**: 新規ドメイン追加時に `config/domains/{domain}.json` のスキーマ (`layers` / `targets` / `tabs` / `genreColors` / `seasonalPatterns`) の埋め方とコレクター実装の必要性を一緒に詰める
- **UX の翻訳**: 「ゲーム運用ペルソナ」「広告運用ペルソナ」のように実際の使い手の動作を起点に、ダッシュボード UI の優先順位を議論する
- **機能追加の抑制**: ビジョン (現在地 / 推移 / 次の一手) と既存の完成度維持を優先し、闇雲な機能追加は避ける立場で判断を揃える

## 注意事項・前提

- **ビジョンは「蓄積」**: データ収集精度の向上より因果ログが積み上がり続けることを優先する。データソースは後で差し替え可能だが蓄積は時間がかかる
- **3タブ構成は固定**: 現在地 / 推移 / 次の一手 の骨格は全ドメイン共通。中身はドメイン設定とユーザー設定で可変
- **ドメイン非依存 vs ドメイン固有**: 分析層 (anomaly / trend / causation / actionRecommender) はドメイン非依存に保つ。ドメイン固有ロジックは素直に ドメイン設定 or ドメインフォルダに書く (過度な抽象化は避ける)
- **市場補正の原則**: 施策効果は必ず同時期の市場 baseline を差し引いた純効果で評価する。「追い風に乗っただけ」の記録で推奨が汚染されないようにする
- **自動検証の非循環**: 検出時点と検証時点のデータは分離する。検出データで即 confirmed にしない
- **Nitter は不安定前提**: 非公式ミラーで停止リスクあり。`NITTER_DISABLE=1` でフォールバック、将来は X API / snscrape への切替を視野に入れた薄いラッパに留める
- **YouTube API クォータ**: 無料枠 10,000/日、1チャンネル 3 units。対象に `youtube_channel_id` がある場合のみ実行
- **LLM は必須ではない**: Ollama 未接続でもテンプレートフォールバックで動く。LLM に機能依存しない
- **GitHub Pages 配信**: Vite `base: './'` の相対パス構成を崩さない (Vercel でも動くようにしてある)
- **予測の確実性は謳わない**: 勝率を上げることはできても確実ではない、というトーンを崩さない
- **過去に検討済み**: SQLite 移行、完全手動入力 UI、全ドメイン同時開発はいずれも却下済み (それぞれ IndexedDB、ハイブリッド入力、メイン優先 で決着)
- **作業ブランチ**: `claude/<task>` の形式でブランチを切り、master への直 push は避ける

## 調査手順

このスキルが発動したとき、最新状況を把握するために以下を優先して参照する:

1. `CLAUDE.md` — プロジェクト規約と「次の実装課題」リスト (どこまで完了しているか)
2. `docs/vision.md` / `docs/architecture.md` / `docs/data-density-backlog.md` — ビジョン・設計判断・既知の課題
3. `config/domains/` — 稼働中のドメイン定義と各レイヤーのデータソース
4. `src/collectors/` と `src/analyzers/` を俯瞰 — どのソースが実運用で、どこがモックか
5. 直近 20 件のコミットログ — 最近手を入れた箇所と進行中のテーマ
6. 不明な点は推測で埋めず「現時点では未定 / ドキュメントに記載なし」と明記する
