---
title: アーキテクチャ概要
category: 05-architecture
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md, raw/notes/archive/continuefrom.md, raw/notes/archive/next-phase-plan.md, raw/notes/planning/architecture-review.md]
---

# アーキテクチャ概要

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React Native（Expo SDK 55） |
| バックエンド | Node.js + Express + TypeScript |
| ORM | Prisma |
| データベース | Supabase PostgreSQL |
| 認証 | Supabase Auth（JWT）。ゲスト認証対応 |
| ストレージ | Supabase Storage（`medication-photos`バケット） |
| AIチャット | Anthropic Claude Haiku API |
| サブスクリプション | RevenueCat |
| デプロイ（バックエンド） | Railway（`https://kusunavi-production.up.railway.app`） |

## バックエンド構成

```
src/
  routes/index.ts        # 全ルートを /api 以下にマウント
  controllers/           # ルーティング → コントローラー
  services/              # ビジネスロジック
  middleware/            # 認証・権限・レート制限・バリデーション
  data/                  # 医療ロジックデータ（変更禁止）
  config/env.ts          # zod による環境変数バリデーション
  lib/supabase.ts        # Supabaseクライアント
```

### 主要サービス

| ファイル | 役割 |
|---------|------|
| `symptom.service.ts` | トリアージアルゴリズム・危険サイン検出・推奨エンジン |
| `pharmacistChat.service.ts` | AIチャット（Claude Haiku） |
| `medication.service.ts` | 薬CRUD・相互作用チェック・KEGG/PMDA情報補完 |

### 医療ロジックデータファイル（変更禁止）

| ファイル | 内容 |
|---------|------|
| `src/data/disease-definitions.ts` | 疾患推定パターン（13種以上） |
| `src/data/symptom-definitions.ts` | 症状質問ツリー |
| `src/data/medications.json` | OTC薬マスタデータ（87件、18カテゴリ） |

> ⚠️ これらのファイルは別チームメンバーが構築した医療ロジック。UI/表示レイヤー以外の修正は明示的な許可なく行わないこと。

### ミドルウェア

- **レート制限**: 3段階
- **認証**: `authMiddleware`（Supabase JWT検証）
- **権限**: ロールベース（`requireRole()`）
- **サブスクリプション**: プレミアム機能ゲート
- **バリデーション**: zod スキーマ

### 環境変数（必須）

```
DATABASE_URL          # Supabase PostgreSQL（pgbouncer経由）
DIRECT_URL            # Supabase PostgreSQL（直接接続）
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
PORT=1785（開発時）
```

## フロントエンド構成

```
src/
  navigation/           # ナビゲーション設定
  screens/              # 画面コンポーネント
  components/           # 共通コンポーネント
  stores/               # 状態管理（Context）
  constants/theme.ts    # カラーパレット（ライト/ダーク）
  i18n/                 # 国際化（日本語デフォルト）
  utils/                # ユーティリティ関数
  services/api.ts       # APIクライアント
```

### ナビゲーション構造

```
AppNavigator
  ├── SetupStack（未認証）
  │   └── Welcome → Login → Consent → ProfileName → ProfileDetails → Ready
  └── MainTab（認証済み）
      ├── HomeStack
      ├── MedicationStack
      ├── ChatStack
      └── FamilyStack
```

### 状態管理（Context）

| Context | 役割 |
|---------|------|
| `AuthContext` | 認証状態・ログイン/ログアウト・セットアップ完了管理 |
| `ThemeContext` | ライト/ダークモード・`colors`オブジェクト提供 |
| `PurchaseContext` | RevenueCatサブスクリプション状態 |

### i18n

- デフォルト言語: **日本語**（強制）
- 対応言語: 日本語・英語
- 名前空間（9種）: common / auth / home / medication / family / symptom / settings / notification / chat

## データモデル概要

| エンティティ | 説明 |
|------------|------|
| User | 認証済みアカウント |
| FamilyGroup + FamilyGroupMembership | 家族グループ（owner/admin/memberロール） |
| FamilyProfile | 家族メンバープロフィール（アカウントなしのメンバーも管理可） |
| HealthProfile | 健康情報（FamilyProfileに紐づく） |
| MedicationMaster | 薬マスタ（87件のOTCデータ） |
| HouseholdMedication | 家庭内在庫薬 |
| SymptomSession | 症状相談セッション |
| RecommendationResult | 判定結果 |
| IntakeLog | 服用記録 |
| Notification / NotificationEvent / NotificationRecipient | 通知（NotificationEvent + NotificationRecipientの2テーブル構成） |
| Reminder | 服薬リマインダースケジュール |

## 重要な実装上の制約

### BlurViewの制約
```typescript
// ❌ 直接importしない
import { BlurView } from 'expo-blur';

// ✅ __DEV__ 条件パターンを使う（MainTabNavigator.tsx）
const BlurView = __DEV__ ? null : require('expo-blur').BlurView;
```
`expo-blur`のネイティブモジュールは開発ビルドで使用不可。必ずこのパターンを維持すること。

### フローティングタブバー
タブバーは`position: absolute`でコンテンツに重なる。すべてのスクロール可能画面は`paddingBottom: 100`が必要。

### 全テキストの日本語必須
UIテキスト・警告・アドバイス・エラーメッセージはすべて日本語。i18nキーを使用すること。

## 開発コマンド

```bash
# バックエンド
cd backend
npm run dev              # 開発サーバー起動（ポート1785）
npm run build            # prisma generate && tsc
npm test                 # vitest run
npm run db:push          # スキーマをDBにプッシュ
npm run db:studio        # Prisma Studio起動

# フロントエンド
cd frontend
npm start                # expo start
npm test                 # jest --forceExit
npx tsc --noEmit --skipLibCheck  # 型チェック
```

## 関連記事

- [[クスナビ プロダクト概要・機能一覧]]
- [[症状トリアージ・判定ロジック]]
- [[開発フェーズ履歴]]