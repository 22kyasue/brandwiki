---
title: バックエンドアーキテクチャ
category: 05-architecture
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md, raw/notes/notes__archive__next-phase-plan.md]
---

# バックエンドアーキテクチャ

## 技術スタック

- **言語**: Node.js + TypeScript
- **フレームワーク**: Express
- **ORM**: Prisma
- **データベース**: Supabase PostgreSQL
- **認証**: Supabase Auth（JWT）
- **ストレージ**: Supabase Storage（`medication-photos` バケット）
- **AI**: Anthropic Claude API（Haiku）
- **デプロイ**: Railway（https://kusunavi-production.up.railway.app）

## レイヤー構成

```
Routes → Controllers → Services → Prisma Client → Supabase PostgreSQL
```

## ルーティング

`src/routes/index.ts` が全ルートを `/api` 配下にマウント:

- `/api/auth` — 認証
- `/api/family` — 家族プロフィール
- `/api/medications` — 薬管理
- `/api/symptom-sessions` — 症状トリアージ
- `/api/pharmacist-chat` — AI薬剤師チャット
- `/api/prescription-info/query` — 処方薬情報検索（Phase E）
- 他多数

## キーデータファイル（医療ロジック — 変更厳禁）

- `src/data/disease-definitions.ts` — 疾患推定パターン（13+）
- `src/data/symptom-definitions.ts` — 症状質問ツリー
- `src/data/medications.json` — OTC薬データベース（87件、JANコード検証済み）

詳細: [[critical-constraints]]

## キーサービス

- `symptom.service.ts` — トリアージアルゴリズム、危険サイン検出、推薦エンジン
- `pharmacistChat.service.ts` — AI薬剤師チャット
- `medication.service.ts` — CRUD、飲み合わせチェック、KEGG／PMDAエンリッチメント
- `prescriptionInfo.service.ts` — 処方薬情報検索（Phase E）

## ミドルウェア

- **Rate limiting** — 3 tiers（auth／normal／expensive）
- **Auth** — Supabase JWT 検証
- **Permission** — Role-based（owner／admin／member）
- **Subscription** — Premium機能ゲーティング
- **Validation** — Zod スキーマ

## Env validation

`src/config/env.ts` が Zod スキーマを使用。`process.env.NODE_ENV === 'test'` で安全なデフォルトを提供しレート制限を無効化。

## 必要な環境変数

- `DATABASE_URL`、`DIRECT_URL`
- `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `PORT`（dev: 1785／3182）
- `CORS_ORIGIN`（本番ホワイトリスト）

## デプロイ

- Railway に Dockerfile でデプロイ
- GitHub 連携で自動デプロイ
- ビルドステップに `prisma generate` を含む

関連: [[architecture-frontend]]、[[data-model]]、[[deployment-and-ops]]