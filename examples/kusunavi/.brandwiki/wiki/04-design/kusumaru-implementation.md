---
title: くすまるの実装と季節衣装
category: 04-design
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/kusumaru-enhance.md]
---

# くすまるの実装と季節衣装

[[kusumaru-mascot]] のフロントエンド実装ガイド。

## コンポーネント

`frontend/src/components/common/Kusumaru.tsx`

`react-native-svg` でインライン実装されており、`emotion` と `accessory` の prop を受け取る。

## Emotion 型

```ts
type Emotion =
  | 'calm' | 'happy' | 'worried' | 'curious' | 'excited'
  | 'chatListening' | 'chatThinking'
  // 他多数
```

## 季節アクセサリー（実装済み）

`accessory` prop で 8 種類のアクセサリーを差し替え可能。**全て SVG インライン**（絵文字ゼロ）。

```ts
type AccessoryType =
  | 'none' | 'nightcap' | 'santa' | 'pumpkin' | 'sakura'
  | 'strawHat' | 'coffee' | 'umbrella' | 'sunglasses'
```

z-order 修正済み: アクセサリーをボディの **後** に描画して上に表示される。

## 自動選択ロジック

`frontend/src/utils/seasonalDecoration.ts`:

| 期間／時刻 | アクセサリー |
|---|---|
| 12/20-12/26 | サンタ帽 |
| 10/25-10/31 | かぼちゃ |
| 3/20-4/10 | 桜 |
| 7-8月 | 麦わら帽 |
| 21-5時 | ナイトキャップ |

## 統合場所

- `HomeScreen.tsx` — `getSeasonalAccessory()` をヒーローくすまるに自動適用
- `KusumaruPreviewScreen.tsx` — 全アクセサリーグリッド + 選択チップ

## 実装方針の変更点（記録）

計画では `costume` prop + ディレクトリ分割 + Context + 設定画面の構成だったが、実装時に以下に変更:

- prop 名は `accessory`（`AccessoryType`）
- SVG は `Kusumaru.tsx` 内に **インライン定義**（`costumes/` ディレクトリ分割しない — 依存をシンプルに保つため）
- Context／設定画面は **作らず**、日付ベース自動選択のみで完結

## 通知統合（Phase 1 完了）

- プッシュ通知にくすまるのセリフ・タイトルを付加（バックエンド）
- アプリ内通知一覧をチャット吹き出しスタイル
- 通知タイプに応じた感情表示（worried / happy / excited）
- 通知詳細画面にヒーローセクション + 挨拶セリフ

## 次に予定されているもの

### チャットアシスタント（[[ai-pharmacist-chat]]）
ヒーローくすまるの感情ステートマシン、ユーザーメッセージのキーワードマッチで相槌リアクション。`chatKusumaruReactions.ts` 新規。

### 声かけバリエーション拡充
`kusumaruMessages.ts` に文脈別フレーズ追加。連続利用系／家族管理系／服用系／体調気遣い系／季節系。**ゲーミフィケーションにならないように注意**（[[kusumaru-philosophy]]）。

## 未実装（必要になったら追加）

- 門松／雛人形／こいのぼり／卒業帽／聴診器／マスク／マフラー等の追加衣装
- 各 SVG の質感強化（グラデ、影、テクスチャ）
- アニメーション（サンタ帽のポンポン揺れ、傘の雨粒、コーヒーの湯気）
- emotion × accessory 連携
- 体調連動（体調悪い日はマスク自動表示）

関連: [[kusumaru-mascot]]、[[kusumaru-philosophy]]、[[ai-pharmacist-chat]]