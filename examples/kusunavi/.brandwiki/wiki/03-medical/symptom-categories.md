---
title: 対応症状カテゴリと危険サイン
category: 03-medical
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__archive__v1-implementation-spec.md]
---

# 対応症状カテゴリと危険サイン

V1で対応する **9つの主症状カテゴリ**。

| ID | 日本語名 | アイコン |
|---|---|---|
| `headache` | 頭が痛い | head-outline |
| `fever` | 熱がある | thermometer-outline |
| `sore_throat` | 喉が痛い | mic-outline |
| `nasal` | 鼻水・鼻づまり | water-outline |
| `cough` | 咳が出る | cloud-outline |
| `stomach_pain` | 胃が痛い | fitness-outline |
| `abdominal_pain` | お腹が痛い | body-outline |
| `diarrhea` | 下痢をしている | alert-circle-outline |
| `constipation` | 便秘 | remove-circle-outline |

## 共通問診項目

| ID | 質問 | 必須 |
|---|---|---|
| `onset` | いつから症状がありますか？ | Yes |
| `severity` | 症状のつらさは？ | Yes |
| `other_symptoms` | 他に気になる症状は？ | Yes |
| `taken_today` | 今日すでに薬を飲みましたか？ | Yes |
| `taken_today_detail` | 何を飲みましたか？ | No |

## 危険サイン（レッドフラグ）の例

詳細は `disease-definitions.ts` 参照。各症状カテゴリごとに **emergency / high / medium** の3段階。

### headache
- `ds_head_sudden`: 突然の激しい頭痛（今までで最悪） → emergency
- `ds_head_consciousness`: 意識がぼんやり／混乱 → emergency
- `ds_head_numbness`: 手足のしびれ／ろれつが回らない → emergency
- `ds_head_fever_stiff`: 高熱と首の硬直 → emergency

### fever
- `ds_fever_breathing`: 息苦しさ → emergency
- `ds_fever_consciousness`: 意識がぼんやり → emergency
- `ds_fever_infant`: 生後3ヶ月未満の乳児の発熱 → emergency

### sore_throat
- `ds_throat_breathing`: 息がしにくい／飲み込めない → emergency
- `ds_throat_drool`: よだれが出て飲み込めない → emergency

### cough
- `ds_cough_blood`: 血が混じった痰 → emergency
- `ds_cough_breathing`: 呼吸困難 → emergency

### stomach_pain
- `ds_stomach_vomit_blood`: 吐血 → emergency
- `ds_stomach_black_stool`: 黒い便 → emergency
- `ds_stomach_severe`: 動けないほどの激痛 → emergency

### abdominal_pain
- `ds_abdom_severe`: 動けないほどの激痛 → emergency
- `ds_abdom_blood_stool`: 血便 → emergency
- `ds_abdom_rigid`: お腹が板のように硬い → emergency

### diarrhea
- `ds_diarrhea_blood`: 血便 → emergency
- `ds_diarrhea_dehydration`: 尿が出ない／口がひどく乾く → emergency

## 追加確認項目（HealthProfile補完）

| 条件 | 質問 |
|---|---|
| 持病未入力 | 現在治療中の病気（高血圧／糖尿病／喘息／心臓病／肝臓病／腎臓病／胃潰瘍） |
| アレルギー未入力 | 薬のアレルギー（ペニシリン／アスピリン／NSAIDs） |
| 妊娠未確認 ＆ 女性15-50歳 | 現在妊娠中ですか？ |
| 授乳未確認 ＆ 女性 | 現在授乳中ですか？ |

関連: [[triage-algorithm]]、[[health-profile]]