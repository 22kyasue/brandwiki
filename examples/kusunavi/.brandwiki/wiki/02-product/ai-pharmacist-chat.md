---
title: AI薬剤師チャット
category: 02-product
status: draft
confidence: medium
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md, raw/notes/kusumaru-enhance.md, raw/notes/notes__planning__plan-from-here.md]
---

# AI薬剤師チャット

ユーザーが薬や症状について相談できるAIチャット機能。

## 技術構成

- **モデル**: Claude Haiku（コスト効率優先）
- **バックエンド**: `pharmacistChat.service.ts`
- **フロントエンド**: `PharmacistChatScreen.tsx`
- **エンドポイント**: `/api/pharmacist-chat`（推定）

## くすまるとの統合

チャット画面では [[kusumaru-mascot]] がアシスタントとして登場し、ユーザーのメッセージ内容に応じて感情ステートマシンで反応する（[[kusumaru-implementation]] 参照）。

### 感情ステートマシン

| 状態 | 条件 | emotion |
|---|---|---|
| idle | 入力欄が空・送信前 | `calm` |
| composing | 入力欄にフォーカス | `chatListening` |
| sending | API応答待ち | `chatThinking` |
| reacting | 最新ユーザーメッセージに感情ヒット | 推定emotion（2秒保持→idle復帰） |

感情推定は **フロント側のキーワードマッチで完結** させ、バックエンドの医療ロジックには手を入れない。

## 今後の拡張（Phase H）

| ID | タスク | 優先度 |
|---|---|---|
| H-1 | AIモデルアップグレード（Haiku → Sonnet） | 中 |
| H-2 | フリーテキスト症状入力 | 中 |
| H-3 | 「前回と同じ症状」クイックボタン | 低 |
| H-4 | チャット履歴のDB永続化 | 低 |
| H-5 | プロンプトチューニング | 低 |

## 制約

- 全回答は **日本語**（[[critical-constraints]]）
- 医療免責表示が必須
- 医療ロジック層（症状トリアージ、推薦エンジン）は別チームメンバーが構築 — UI／表示層のみ変更可

関連: [[triage-algorithm]]、[[kusumaru-implementation]]、[[critical-constraints]]