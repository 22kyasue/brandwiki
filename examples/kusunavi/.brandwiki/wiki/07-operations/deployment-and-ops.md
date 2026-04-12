---
title: デプロイと運用
category: 07-operations
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__archive__next-phase-plan.md, raw/notes/notes__archive__continuefrom.md, raw/notes/CLAUDE.md]
---

# デプロイと運用

## 本番URL

- バックエンド: https://kusunavi-production.up.railway.app
- Railway プロジェクト名: `kusunavi-api`

## バックエンドコマンド

```bash
cd backend
npm run dev          # tsx watch, port 1785
npm run build        # prisma generate && tsc
npm test             # vitest run
npm run test:watch
npm run db:push      # スキーマをDBへpush
npm run db:studio    # Prisma Studio 起動
```

## デプロイフロー（Railway）

- Dockerfile マルチステージビルド
- GitHub 連携で自動デプロイ
- ビルドステップに `prisma generate` を含む
- 環境変数は Railway ダッシュボードで管理

## 必要な環境変数

```
DATABASE_URL=postgresql://...?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...
PORT=3182
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-...
CORS_ORIGIN=...
```

`.env` は git管理外。`.env.example` に必要な変数を文書化済み。

## テスト環境

- `process.env.NODE_ENV === 'test'` で `env.ts` の安全デフォルトを提供
- レート制限を `noopMiddleware` で無効化

## CI/CD（Phase D-2 完了）

- GitHub Actions: `ci.yml` + `eas-build.yml`

## App Store 準備（Phase D-3 完了）

- `app.json` メタデータ
- `eas.json` submit config
- `store-metadata.md`
- EAS project ID: `572f2df5-97a9-461b-b265-9a88cee3b4fb`

## パフォーマンス対策（Phase D-4 完了）

- DB indexes
- gzip compression
- React.memo
- FlatList tuning（windowSize、maxToRenderPerBatch、removeClippedSubviews）

## 監視（Phase D-5 完了）

- Enhanced health check
- Error tracking middleware
- `/metrics` エンドポイント

## レート制限

3 tiers。テスト環境では noop。

## バージョン管理

ユーザーフィードバック（`feedback_version_on_push.md` メモリ）:

> プッシュ前に必ず `app.json`、`frontend/package.json`、`backend/package.json` のバージョンをbump

## テスト状況

- バックエンド: 298 tests passing（25 files）、1 skipped file
- フロントエンド: 113 tests
- E2E: 7 journeys

## オーナー

- GitHub: `22kyasue`

関連: [[architecture-backend]]、[[future-roadmap]]、[[critical-constraints]]