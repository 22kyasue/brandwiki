---
title: フェーズ別開発史
category: 08-history
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__archive__next-phase-plan.md, raw/notes/notes__archive__continuefrom.md, raw/notes/notes__planning__plan-from-here.md, raw/notes/notes__planning__architecture-review.md]
---

# フェーズ別開発史

## V0〜V2 機能実装（完了）

105/105 タスク完了。`detailedstepplan.md` 参照。

## Phase 1〜5 — アーキテクチャ進化（完了）

ファミリーモデルの根本的な再設計。詳細: [[data-model]]、[[notification-system]]

| Phase | 内容 | 完了日 |
|---|---|---|
| Phase 1 | FamilyMember Evolution（`linkedUserId` nullable化、`familyGroupId`、`status`） | 完了 |
| Phase 2 | Reminders + ownerType（Reminder model） | 完了 |
| Phase 3 | Audit Trail（`recordedByUserId`、`InventoryEvent`） | 完了 |
| Phase 4 | FamilyGroup Roles & Permissions（owner/admin/member） | 完了 |
| Phase 5 | Notification Architecture Upgrade（Event + Recipient 分割） | 完了 |

## Phase A — 品質基盤（完了）

## Phase B — 拡張機能（完了）

- ソーシャルログイン（基盤）
- OCR
- PMDA／KEGG エンリッチメント
- プッシュ通知

## Phase C — UX 強化（完了）

- ダークモード
- 服薬グラフ
- データエクスポート
- i18n（日英）

## Phase D — デプロイ準備（完了 2026-03-12）

| ID | 内容 |
|---|---|
| D-1 | レート制限（3 tiers）、env validation（zod）、CORS production whitelist、Helmet CSP |
| D-2 | CI/CD（GitHub Actions） |
| D-3 | App Store prep |
| D-4 | パフォーマンス（DB indexes、gzip、React.memo、FlatList tuning） |
| D-5 | 監視（health check、error tracking、`/metrics`） |

## Phase E — Enhanced Triage Intelligence（完了）

| ID | 内容 |
|---|---|
| E-0 | KEGG enrichment + interaction rules + detail endpoint |
| E-1 | Cross-medication interaction check |
| E-2 | 疾患推定アルゴリズム（13パターン） |
| E-3 | 処方薬情報検索 |
| E-4 | 推薦エンジン polish |

新規追加:

- `disease-definitions.ts`
- `prescriptionInfo.service.ts`
- `RecommendationResult` に `estimatedConditions`、`selfCareAdvice` 追加
- `POST /api/prescription-info/query`
- `PrescriptionInfoScreen`
- 新分類 `recommended`（candidate より上位）

## くすまる強化（部分完了 2026-04-11）

- ✅ 通知アバター（プッシュ + アプリ内）
- 🟡 季節衣装 8種 SVG（自動選択完了、設定画面/追加衣装は未）
- ❌ チャットアシスタント（次の予定）
- ⏸️ 実績／バッジシステム（[[kusumaru-philosophy]] により保留）
- ⏸️ 成長／進化システム（同上）

詳細: [[kusumaru-implementation]]、[[kusumaru-philosophy]]

## 設計議論の履歴

- 2026-03-08: ChatGPT による初期コンセプト検討（`クスナビfull-chatgpt-log.md`）
- 2026-03-09: Phase 4 完了（薬マスタ87件 + JANコード検証）
- 2026-03-10: アーキテクチャレビュー（family-based 再設計）
- 2026-03-12: Phase D 完了
- 2026-04-11: くすまる季節衣装実装、デザイン哲学確定（ゲーミフィケーション拒否）
- 2026-04-12: Step 4-5 保留決定、Step 7-9 新方針追加

関連: [[feature-overview]]、[[future-roadmap]]、[[kusumaru-philosophy]]