---
title: 機能全体像とバージョンロードマップ
category: 02-product
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__archive__project-description.md, raw/notes/notes__archive__detailedstepplan.md, raw/notes/notes__archive__next-phase-plan.md, raw/notes/notes__planning__plan-from-here.md]
---

# 機能全体像とバージョンロードマップ

## V0 — 家庭内薬ストック管理基盤

「家に何の薬があるか」「いつ切れるか」「どれだけ残っているか」「誰の薬か」が分かる状態を作る。

- 家族プロフィール作成
- 健康プロフィールの基本登録
- 薬登録（写真／バーコード／手入力）
- 薬一覧／詳細／編集
- 使用期限・残数・保管場所管理
- 基本通知

## V1 — 症状相談と安全優先の候補整理

症状時に、家にある薬の中から安全性を優先して整理された結果を返す。

- 主症状選択（9カテゴリ）
- 共通問診・症状別問診
- 危険サイン確認
- 緊急性／禁忌／重複成分／適応一致判定
- 候補 / 注意 / 非推奨 / 受診推奨 の出力
- 理由表示

詳細: [[triage-algorithm]]、[[symptom-categories]]

## V2 — 継続利用と個別最適化

- 服用記録／服用履歴
- 症状相談履歴／再相談
- 同日服用反映
- 通知強化

## Phase A〜D（実装済み）

| Phase | 内容 |
|---|---|
| Phase A | 品質基盤 |
| Phase B | ソーシャルログイン、OCR、PMDA／KEGG、プッシュ通知 |
| Phase C | ダークモード、グラフ、エクスポート、i18n |
| Phase D | デプロイ準備（レート制限、env validation、CORS、CI/CD、App Store準備、パフォーマンス、監視） |

## Phase E（実装済み）— Enhanced Triage Intelligence

- 疾患推定アルゴリズム（13パターン）
- 処方薬情報検索
- 飲み合わせチェック強化
- 「recommended」分類（candidateより上位）

## Phase F以降（今後）

詳細は [[future-roadmap]] 参照。F: 収益化・ソーシャルログイン / G: データ拡充・API連携 / H: AI・UX改善 / I: エンゲージメント・運用 / J: App Storeリリース

関連: [[architecture-backend]]、[[architecture-frontend]]、[[future-roadmap]]