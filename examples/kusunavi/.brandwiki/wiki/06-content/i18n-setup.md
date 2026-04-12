---
title: i18nセットアップとnamespace構成
category: 06-content
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md]
---

# i18nセットアップとnamespace構成

## 構成

`frontend/src/i18n/`

- **言語**: 日本語（デフォルト） + 英語
- **デフォルト**: 強制的に `ja`
- **ライブラリ**: i18next

## 9 namespaces

| Namespace | 用途 |
|---|---|
| `common` | 共通UIテキスト、ボタンラベル等 |
| `auth` | 認証フロー（ログイン、サインアップ） |
| `home` | ホーム画面、くすまるメッセージ |
| `medication` | 薬管理、登録、詳細 |
| `family` | 家族プロフィール |
| `symptom` | 症状トリアージ、問診 |
| `settings` | 設定画面 |
| `notification` | 通知 |
| `chat` | AI薬剤師チャット、くすまる相槌 |

## 重要な制約

> **全ユーザー向けテキストは日本語必須。** 英語をUI、警告、アドバイス、エラーメッセージに含めてはならない。i18n 翻訳キー経由で必ずアクセスすること。

詳細: [[critical-constraints]]

## くすまるメッセージ

`home.json` の `kusumaruMessages` セクションには時間帯ベースの挨拶（morning/afternoon/evening）が含まれる。今後、文脈別フレーズの拡充が予定されている（[[kusumaru-implementation]]）:

- 連続利用系
- 家族管理系
- 服用系（達成感ではなく優しい励まし）
- 体調気遣い系
- 季節系

## 注意

- 毎日同じメッセージは避ける（ランダム選択 + キャッシュで重複防止）
- 過度に褒めない（「すごい！」「さすが！」連発は逆効果）
- 落ち着いたトーン維持

## 関連ファイル（既存）

- `frontend/src/utils/kusumaruMessages.ts` — 時間帯ベース挨拶
- `frontend/src/utils/chatGreeting.ts` — チャット挨拶

関連: [[critical-constraints]]、[[kusumaru-mascot]]、[[architecture-frontend]]