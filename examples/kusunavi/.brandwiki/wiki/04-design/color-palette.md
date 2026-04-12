---
title: カラーパレットとテーマシステム
category: 04-design
status: draft
confidence: medium
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md, raw/notes/character-design-capkun.md, raw/notes/notes__planning__home-redesign-brief.md]
---

# カラーパレットとテーマシステム

## 全体の方向性

ベース: **暖かいオフホワイト系**。彩度を少し抑えて「医師監修感のある落ち着き」を出す。ポップすぎる発色は避ける。

## アクセントカラーの意味

| 色系統 | 用途 |
|---|---|
| **コーラル系** | 薬・記録・通知・主要導線（薬を登録する／症状を相談する） |
| **グリーン系** | 相談・家族・安心感 |
| **ブラウン〜グレー系** | 補助情報・履歴・非アクティブ |

## くすまるカラー（厳密）

[[kusumaru-mascot]] 参照。

| パーツ | カラーコード |
|---|---|
| 体上半分（ピーチ） | `#E8837C` |
| 体下半分（クリーム） | `#FFF5EE` |
| 目／口／輪郭 | `#3D2C2C` |
| ほっぺ | `#F2A59E` |
| 葉っぱ | `#7BC67E` |

## テーマシステム

`frontend/src/constants/theme.ts` に Light / Dark パレットを定義。**セマンティックカラー** を含む:

- OTCバッジ色（第1類／第2類／第3類医薬品）
- 薬カテゴリ色
- 警告パネル色

## 使用ルール

> **常に `useTheme()` フックを使う。色をハードコードしてはいけない。**

```ts
const { colors } = useTheme();
// colors.primary, colors.background, colors.warning, etc.
```

## ダークモード

Phase C で実装。Light / Dark の両パレットがフルサポートされている。

## タイポグラフィ方針

文字は丸すぎず硬すぎず、信頼感と親しみやすさの中間。

- 数値は大きく見やすく
- セクションタイトルは明確
- 補助テキストは控えめ
- 情報の優先順位が文字サイズだけで分かること

タイトルや見出しは「整理された医療サービス」としての読みやすさを優先。

## 余白

> このUIの信頼感は、色や装飾よりも **余白設計** で決まる。

カード間隔・セクション間隔を統一し、画面上部は贅沢に余白を取る。詳細は [[home-redesign-brief]]。

関連: [[home-redesign-brief]]、[[kusumaru-mascot]]、[[architecture-frontend]]