---
title: 今後のロードマップ（Phase F〜J）
category: 02-product
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__planning__plan-from-here.md]
---

# 今後のロードマップ（Phase F〜J）

> 2026-03-27 時点。現在 Frontend v1.11.0 / Backend v0.21.0、Phase A〜E 完了。

## 即対応（ブロッカー）

- Supabase ダッシュボードで「Allow anonymous sign-ins」を ON にする（ゲストフロー必須）

## Phase F: 収益化・ソーシャルログイン

| ID | タスク | 優先度 |
|---|---|---|
| F-1 | ソーシャルログイン（Google／Apple OAuth） | 高 |
| F-2 | サブスクリプション導入（RevenueCat） | 高 |
| F-3 | プレミアム機能ゲーティング | 中 |
| F-4 | ファミリープラン機能 | 中 |

**価格案**: Free / Premium（¥400/月）/ Family（¥900/月）

**プレミアム機能候補**: AI無制限チャット、バーコード無制限、PMDA検索、グループAI枠（30回/月）、家族レポート、クロス服薬チェック

## Phase G: データ拡充・API連携

| ID | タスク | 優先度 |
|---|---|---|
| G-1 | OTCマスターデータ拡充（87件 → 500〜1000件） | 高 |
| G-2 | Google検索API連携 | 中 |
| G-3 | Apple Health連携（体重・歩数・睡眠・心拍） | 中 |
| G-4 | OCR精度向上 | 低 |

## Phase H: AI・UX改善

[[ai-pharmacist-chat]] 参照。

## Phase I: エンゲージメント・運用

| ID | タスク | 優先度 |
|---|---|---|
| I-1 | 週次／月次ファミリー健康レポート | 中 |
| I-2 | 服薬共有提案機能 | 低 |
| I-3 | マルチファミリー安全チェック | 低 |
| I-4 | ユーザー投稿型薬データ | 低 |

## Phase J: App Store リリース

| ID | タスク | 優先度 |
|---|---|---|
| J-1 | App Store審査対応（メタデータ・スクショ） | 高 |
| J-2 | EASビルド & Submit | 高 |
| J-3 | Google Play対応 | 高 |
| J-4 | プライバシーポリシー・利用規約（薬事法・個人情報保護法準拠） | 高 |

## 推奨実行順序

1. 匿名サインイン有効化（即時）
2. J-4 プライバシーポリシー・利用規約
3. F-1 ソーシャルログイン
4. F-2 サブスクリプション
5. G-1 OTCデータ拡充
6. J-1〜J-3 App Storeリリース
7. H-1〜H-5 AI改善
8. I-1〜I-4 エンゲージメント機能

## 既知の問題

| 問題 | 影響度 |
|---|---|
| Web版でカメラ／バーコードスキャン不可 | 低 |
| ゲストデータがログアウト後消失 | 中（匿名サインイン有効化で改善） |
| 症状選択画面のアイコンサイズ不統一 | 低 |

関連: [[feature-overview]]、[[deployment-and-ops]]