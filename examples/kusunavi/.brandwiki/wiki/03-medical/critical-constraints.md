---
title: 医療・コンテンツ上の絶対制約
category: 03-medical
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/CLAUDE.md, raw/notes/kusumaru-enhance.md]
---

# 医療・コンテンツ上の絶対制約

クスナビプロジェクトには、AIエージェントとチームメンバー双方が **絶対に守らなければならない** 制約がある。

## 1. 全UIテキストは日本語

> **ALL user-facing text MUST be in Japanese (日本語)**

UI、警告、アドバイス、エラーメッセージに英語を含めてはならない。i18n 翻訳キーを使用すること。デフォルト言語は強制的に `ja`。

## 2. 医療ロジックを変更してはならない

> **DO NOT modify medical logic**

以下は別チームメンバー（ユーザーの恋人）が構築したもので、UI／表示層 **以外** は明示的な許可なく変更してはいけない:

- 症状トリアージアルゴリズム（[[triage-algorithm]]）
- 薬剤推薦エンジン
- 飲み合わせチェック
- 疾患定義（`src/data/disease-definitions.ts`）
- 安全性バリデータ
- 症状定義（`src/data/symptom-definitions.ts`）
- 薬データベース（`src/data/medications.json`）

## 3. 日本の薬事基準を厳守

- OTC分類: 第1類／第2類／第3類医薬品
- 添付文書フォーマット
- データソース: PMDA／KEGG
- ガイドライン: 厚生労働省、PMDA、日本薬剤師会

## 4. ゲーミフィケーションを入れない

詳細は [[kusumaru-philosophy]]。実績／バッジ／ストリーク／レベル／XP／キャラクター進化は **すべて却下** されている。

理由: 医療アプリのトーンと合わない／薬を「ゲーム化」するのは服用動機を歪める／厚労省・薬剤師会のガイドライン的に微妙。

## 5. フローティングタブバー

タブバーは absolute position でコンテンツに重なる。全スクロール画面は `paddingBottom: 100` を scroll content に追加してオーバーラップを回避すること。

## 6. expo-blur BlurView を直接インポートしない

> **NEVER directly import `expo-blur` BlurView**

ネイティブモジュールが dev build で使用不可で、`Unimplemented component: ExpoBlurView` という赤いエラーが LogBox／ErrorBoundary で抑制できない。

`MainTabNavigator.tsx` の `__DEV__` 条件パターンを必ず使う:

```ts
const BlurView = __DEV__ ? null : require('expo-blur').BlurView;
```

BlurView が null のときは higher opacity（0.97）の `<View>` をフォールバック。**このパターンを変更するな**。`import { BlurView } from 'expo-blur'` を直接使うな。

## 7. 通信は日本語のみ

> **ユーザーへの返答はすべて日本語で行うこと。** English is not acceptable in responses to the user.

関連: [[design-principles]]、[[kusumaru-philosophy]]、[[i18n-setup]]