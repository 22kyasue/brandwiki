---
title: 症状トリアージ・判定ロジック
category: 03-medical
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/archive/v1-implementation-spec.md, raw/notes/archive/project-description.md, raw/notes/symptom-test-checklist.md]
---

# 症状トリアージ・判定ロジック

> ⚠️ **読み取り専用の知識記録。** このロジックは`backend/src/services/symptom.service.ts`および`src/data/`以下に実装済み。変更は明示的な許可なく行わないこと。

## V1対応 主症状カテゴリ（16カテゴリ以上）

テストチェックリストに基づく対応カテゴリ:

| ID | 日本語名 |
|----|---------|
| headache | 頭痛 |
| fever | 発熱 |
| sore_throat | 喉の痛み |
| nasal | 鼻水・鼻づまり |
| cough | 咳 |
| stomach_pain | 胃痛 |
| abdominal_pain | 腹痛 |
| diarrhea | 下痢 |
| constipation | 便秘 |
| skin_rash | 皮膚のかゆみ・発疹 |
| back_pain | 腰痛・関節痛 |
| dizziness | めまい |
| fatigue | だるさ・疲労感 |
| insomnia | 眠れない |
| eye_fatigue | 疲れ目・ドライアイ |
| eye_allergy | 目のかゆみ・充血 |

## 問診フロー

```
対象者選択
  → 主症状選択
    → 共通問診（全症状共通）
      → 危険サイン確認  ← ★最重要：薬候補提示より先
        ├── レッドフラグあり → 受診推奨画面（薬候補なし）
        └── レッドフラグなし → 症状別問診
            → 追加確認（HealthProfile不足分の補完）
              → 判定エンジン
                → 判定結果表示
```

## 共通問診項目

| 質問ID | 内容 | 必須 |
|--------|------|:----:|
| onset | いつから（今日/2〜3日前/1週間前/それ以上前） | ✅ |
| severity | つらさ（軽い/中程度/つらい/非常につらい） | ✅ |
| other_symptoms | 他の症状（複数選択可） | ✅ |
| taken_today | 今日すでに薬を飲んだか | ✅ |

## 危険サイン（レッドフラグ）の定義例

各症状カテゴリに対して `medium` / `high` / `emergency` の3段階で定義。

| 症状 | 危険サイン例 | 緊急度 |
|------|------------|--------|
| 頭痛 | 突然の激しい頭痛（今までで最悪） | emergency |
| 頭痛 | 手足のしびれ・ろれつ回らない | emergency |
| 頭痛 | 高熱と首の硬直 | emergency |
| 発熱 | 生後3ヶ月未満の乳児の発熱 | emergency |
| 発熱 | 息苦しさ | emergency |
| 喉の痛み | 息がしにくい・飲み込めない状態 | emergency |
| 咳 | 血が混じった痰 | emergency |
| 胃痛 | 吐血 | emergency |
| 腹痛 | 動けないほどの激痛・板状硬直 | emergency |
| 下痢 | 血便＋ほとんど水分が摂れない | emergency |

## 判定パイプライン

```
入力: SymptomSession + HealthProfile + HouseholdMedications[]

Step 1: 緊急性判定
  emergency/high レッドフラグ → shouldSeeDoctor=true

Step 2: 対象薬フィルタリング
  → isActive=true のみ、期限切れ除外、残数0除外

Step 3: 各薬について判定
  3a. 適応一致チェック（症状カテゴリ vs MedicationMaster.indications）
  3b. 禁忌チェック（contraindications / pregnancyWarning / ageRestrictions / avoidIngredients）
  3c. 重複成分チェック（当日服薬 / HealthProfile.regularMedications）
  3d. 不確実性スコアリング

Step 4: 分類出力
  candidate | caution | not_recommended | see_doctor

Step 5: 理由文生成

Step 6: ソート＆出力
```

## 分類ロジック（要約）

| 条件 | 分類 |
|------|------|
| 禁忌該当 | not_recommended |
| 重複成分あり（深刻） | not_recommended |
| 適応 no_match | not_recommended |
| 不確実性スコア ≥ 3 | caution |
| 適応 full_match・禁忌なし・重複なし・不確実性 < 2 | candidate |
| 適応 partial_match または 不確実性 1〜2 | caution |

## 緊急度判定

| 条件 | urgencyLevel | shouldSeeDoctor |
|------|-------------|:---------------:|
| emergency レッドフラグ | emergency | true（「今すぐ医療機関を受診」） |
| high レッドフラグ | high | true（「本日中に相談」） |
| severity=非常につらい + onset=今日 | medium | true（ソフト推奨） |
| onset=それ以上前 + severity≥中程度 | low | 注記表示 |

## 不確実性が高いとみなす条件

以下のいずれかがある場合、候補ランクを下げる：
- 薬の同定が不完全・成分不明
- 使用期限不明
- HealthProfile不足
- 問診不足
- 当日服薬情報が不十分
- 重複可能性あり
- 持病・常用薬の確認ができていない

## 安全ルール（絶対原則）

1. 危険サイン確認を薬候補提示より**先**に行う
2. 緊急性が疑われる場合は受診勧奨を優先する
3. 禁忌に当たる薬は候補から除外する
4. 不確実性が高い場合は強く推奨しない
5. 理由のない推薦はしない
6. アプリを診断アプリとして見せない

## 特別ルール

### 年齢別
- **乳幼児（0〜2歳）**: 全症状で受診推奨をデフォルト表示
- **小児（3〜14歳）**: 成人用薬は自動でnot_recommended（`ageRestrictions`チェック）
- **妊娠中**: `pregnancyWarning=true`の薬は自動でnot_recommended

### 処方薬
- 在庫管理のみ許可。症状相談の推薦対象外。

### 期限切れ薬
- 候補から自動除外（「期限切れのため除外」と理由表示）

## テスト対象（症状テストチェックシート）

各症状カテゴリについて `onset(4種) × severity(4種) = 16パターン` を基本テストセットとして定義済み。
→ `raw/notes/symptom-test-checklist.md` 参照

## 関連記事

- [[アーキテクチャ概要]]
- [[OTC薬マスタデータ]]