---
title: フロントエンドアーキテクチャ
category: 05-architecture
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md]
---

# フロントエンドアーキテクチャ

## 技術スタック

- **フレームワーク**: React Native / Expo SDK 55
- **言語**: TypeScript
- **テスト**: Jest（`jest --forceExit`）
- **状態管理**: React Context（`AuthContext`、`ThemeContext`、`PurchaseContext`）
- **ナビゲーション**: React Navigation
- **i18n**: i18next（`ja` 強制）
- **課金**: RevenueCat
- **ビルド**: EAS Build

## ナビゲーション構造

`src/navigation/`:

- **AppNavigator** — 認証状態に応じて `SetupStack`（オンボーディング）と `MainTab` を切り替え
- **MainTabNavigator** — 4タブ: Home / Medication / Chat / Family。各タブが独自のスタックを持つ
- **SetupNavigator** — Welcome → Login → Consent → ProfileName → ProfileDetails → Ready
- **types.ts** — ナビゲーション型定義

## State管理（`src/stores/`）

| Context | 役割 |
|---|---|
| `AuthContext` | 認証状態、login／logout、setup完了 |
| `ThemeContext` | Light／Darkモード、`colors` オブジェクト提供 |
| `PurchaseContext` | RevenueCat サブスクリプション状態 |

## テーマ（`src/constants/theme.ts`）

Light／Dark パレット + セマンティックカラー（OTCバッジ、カテゴリ、警告パネル）。

> **常に `useTheme()` フックを使う**。色をハードコードしてはいけない。

詳細: [[color-palette]]

## i18n（`src/i18n/`）

日本語（デフォルト） + 英語。**9 namespaces**:

`common` / `auth` / `home` / `medication` / `family` / `symptom` / `settings` / `notification` / `chat`

デフォルト言語は `ja` に強制。詳細: [[i18n-setup]]

## 共通ユーティリティ

- `src/utils/medication.ts` — OTCバッジスタイル、カテゴリ色／ラベル、単位ラベル、日付フォーマット、JSON parse

## 再利用可能コンポーネント（`src/components/`）

| コンポーネント | 役割 |
|---|---|
| `common/Button.tsx` | テーマ対応ボタン（primary／secondary／danger） |
| `common/AnimatedPressable.tsx` | 押下時のスケールアニメーションラッパー |
| `common/Kusumaru.tsx` | マスコット（[[kusumaru-implementation]]） |
| `medication/BulletList.tsx` | 詳細画面用 |
| `medication/DetailWarningsCard.tsx` | 警告カード |
| `medication/DetailKeggSection.tsx` | KEGG セクション |

## フローティングタブバー

タブバーは absolute position でコンテンツに重なる。全スクロール画面は `paddingBottom: 100` を scroll content に追加して回避すること。

## expo-blur 制約

`MainTabNavigator.tsx` で `__DEV__` 条件パターンを必須使用。詳細: [[critical-constraints]]

## コマンド

```bash
cd frontend
npm start                              # expo start
npm test                               # jest --forceExit
npm run test:watch                     # jest --watch
npx tsc --noEmit --skipLibCheck        # 型チェックのみ
```

関連: [[architecture-backend]]、[[kusumaru-implementation]]、[[critical-constraints]]