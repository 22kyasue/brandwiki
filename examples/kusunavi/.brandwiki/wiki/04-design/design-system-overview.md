---
title: デザインシステム概要
category: 04-design
status: draft
confidence: medium
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md, raw/notes/planning/home-redesign-brief.md, raw/notes/character-design-capkun.md]
---

# デザインシステム概要

## デザインの北極星

> 「冷たくない医療」「親しみやすいが、軽く見えない」「家族向けだが、素人っぽく見えない」

目指す印象:
- 清潔感がある・やさしい・医療的に信頼できそう
- 情報が整頓されている・触りやすいがポップすぎない

避ける印象:
- 病院の電子カルテのように冷たい
- 幼児向け知育アプリのように見える
- カードが並んだだけの汎用UIに見える

## カラーパレット

`frontend/src/constants/theme.ts` に定義。ライト/ダークの2テーマ。

**必ず `useTheme()` フックを使用し、カラーをハードコードしない。**

### セマンティックカラーの意味

| 色 | 用途 |
|----|------|
| コーラル系（`#E8837C`付近） | 薬・記録・通知・主要導線 |
| グリーン系（`#7BC67E`付近） | 相談・家族・安心感 |
| ブラウン〜グレー系 | 補助情報・履歴・非アクティブ |

### OTCバッジ・カテゴリカラー

`frontend/src/utils/medication.ts` に OTCバッジスタイル、カテゴリカラー/ラベル、単位ラベル、日付フォーマットを定義。

## タイポグラフィ方針

- 丸すぎず、硬すぎず（信頼感と親しみやすさの中間）
- 数値は大きく見やすく
- セクションタイトルは明確に
- 補助テキストは控えめ
- 情報の優先順位が文字サイズだけで分かること

## 余白・密度

余白設計がUIの信頼感を決める:
- カード間隔・セクション間隔・カード内パディングを統一
- 画面上部は少し贅沢に余白を使う
- 情報を詰め込みすぎない

## コンポーネント

### 共通コンポーネント

| コンポーネント | ファイル | 説明 |
|------------|--------|------|
| Button | `src/components/common/Button.tsx` | テーマ適用ボタン（primary/secondary/dangerバリアント） |
| AnimatedPressable | `src/components/common/AnimatedPressable.tsx` | プレススケールアニメーションラッパー |
| Kusumaru | `src/components/common/Kusumaru.tsx` | マスコット（SVGベース、emotion/accessory prop） |

### 薬詳細コンポーネント

`src/components/medication/` 以下:
- `BulletList` — 箇条書きリスト
- `DetailWarningsCard` — 警告カード
- `DetailKeggSection` — KEGG情報セクション

## ホーム画面のカード種別

| 種別 | 対象 | 特徴 |
|------|------|------|
| 情報カード | 登録済み薬・家族メンバー | 数値を主役、落ち着いた情報表示 |
| 主要CTAカード | 薬を登録する・症状を相談する | 押したく見えるが派手すぎない |
| 空状態カード | 常用薬未登録など | 明確なCTAボタンあり |
| 補助ショートカットカード | 服用履歴・週間レポートなど | 補助導線として軽めに表示 |

## フローティングタブバーの注意点

タブバーは `position: absolute` でコンテンツに重なる。

**すべてのスクロール可能画面は `paddingBottom: 100` が必要。**

## マスコット（クスマル）の使い方

- **使う場所**: ヘッダー横・空状態・相談導線の補助
- **使いすぎない**: 全カードに出すのを避ける
- **役割**: 「ブランド装飾」ではなく「緊張を和らげる補助」

## expo-blur の制約

```typescript
// ❌ 直接import禁止
import { BlurView } from 'expo-blur';

// ✅ MainTabNavigator.tsx のパターンを維持
const BlurView = __DEV__ ? null : require('expo-blur').BlurView;
```

## 関連記事

- [[クスマル・カプくん キャラクター設定]]
- [[クスナビ ブランド概要・ミッション]]
- [[アーキテクチャ概要]]