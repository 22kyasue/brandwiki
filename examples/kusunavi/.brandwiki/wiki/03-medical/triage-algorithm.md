---
title: 症状トリアージアルゴリズム
category: 03-medical
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__archive__v1-implementation-spec.md, raw/notes/CLAUDE.md, raw/notes/notes__archive__project-description.md]
---

# 症状トリアージアルゴリズム

> ⚠️ **読み取り専用の医療ロジック**。`src/services/symptom.service.ts` および `src/data/disease-definitions.ts` 等は、別チームメンバーが構築したものであり、UI／表示層以外は明示的な許可なく変更してはいけない。詳細は [[critical-constraints]] 参照。

## 全体フロー

```
対象者選択 → 主症状選択 → 共通問診 → 危険サイン確認
  → [受診推奨画面 or 症状別問診] → 追加確認 → 判定中 → 判定結果
```

**重要**: 危険サイン確認は症状別問診の **前**。レッドフラグ該当時は薬候補を出さず受診推奨画面へ直行。

## 判定パイプライン（8段階）

1. **緊急性・危険サイン判定** — レッドフラグ該当 → `shouldSeeDoctor=true`、`urgencyLevel`設定
2. **対象薬フィルタリング** — `isActive=true`、期限切れ除外、残数0除外
3. **適応一致チェック** — `MedicationMaster.indications` vs primarySymptom → `full_match` / `partial_match` / `no_match`
4. **禁忌チェック** — `contraindications`、`pregnancyWarning`、`ageRestrictions`、`avoidIngredients`
5. **重複成分チェック** — 当日服薬 vs 成分、`regularMedications` vs 成分
6. **不確実性チェック** — 成分不明（+2）、期限不明（+1）、HealthProfile不足（+1）、partial_match（+1）
7. **分類** — `classify(適応スコア, 禁忌, 重複, 不確実性)`
8. **理由文生成** + ソート

## 分類ロジック

```
if 禁忌該当: → not_recommended
if 重複成分あり: → not_recommended or caution
if 適応 no_match: → not_recommended
if 不確実性スコア >= 3: → caution
if 適応 full_match and 禁忌なし and 重複なし and 不確実性 < 2: → candidate
if 適応 partial_match or 不確実性 1-2: → caution
else: → not_recommended
```

> Phase E で `recommended` 分類（candidateより上位）が追加された。

## 緊急度判定

| 緊急度 | トリガー | アクション |
|---|---|---|
| `emergency` | emergency 危険サイン該当 | 「今すぐ医療機関を受診してください」 |
| `high` | high 危険サイン該当 | 「本日中に医療機関への相談をおすすめします」 |
| `medium` | severity=非常につらい AND onset=今日から | ソフトな受診推奨 |
| `low` | onset=それ以上前 AND severity≧中程度 | 「症状が長引いています」注記 |

## 適応マッチング表

| 症状カテゴリ | indications キーワード |
|---|---|
| headache | 頭痛, 片頭痛, 解熱鎮痛 |
| fever | 発熱, 解熱, 解熱鎮痛, 風邪 |
| sore_throat | のどの痛み, 咽頭痛, 風邪, 鎮痛 |
| nasal | 鼻水, 鼻づまり, 鼻炎, アレルギー, 風邪 |
| cough | 咳, 鎮咳, 去痰, 風邪 |
| stomach_pain | 胃痛, 胃酸, 胸やけ, 消化不良 |
| abdominal_pain | 腹痛, 鎮痛, 整腸 |
| diarrhea | 下痢, 整腸, 止瀉 |
| constipation | 便秘, 緩下, 整腸 |

## 主軸はルールベース

LLMは説明文生成補助のみ。**主判定はルールベース** で構築されている。理由は説明可能性・追跡可能性・安全性。

## エッジケース

| ケース | 対応 |
|---|---|
| 家庭内薬0件 | 「登録されている薬がありません」→ 薬登録画面へ |
| 全薬期限切れ | 「有効期限内の薬がありません」→ 受診検討 |
| 全薬禁忌 | 「現在の条件では使用できる薬がありません」→ 受診推奨 |
| HealthProfile未作成 | 追加確認画面で最低限収集、「情報不足のため参考情報」注記 |
| 乳幼児（0-2歳） | 全症状で受診推奨デフォルト、薬候補は「参考」 |
| 小児（3-14歳） | 成人用薬は自動 not_recommended |
| 妊娠中 | `pregnancyWarning=true` の薬は自動 not_recommended |

関連: [[symptom-categories]]、[[design-principles]]、[[critical-constraints]]