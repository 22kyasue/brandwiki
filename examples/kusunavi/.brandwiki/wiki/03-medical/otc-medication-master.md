---
title: OTC薬マスタデータ・薬登録設計
category: 03-medical
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/archive/next-phase-plan.md, raw/notes/archive/continuefrom.md, raw/notes/planning/15歳以下.md, raw/notes/archive/project-description.md]
---

# OTC薬マスタデータ・薬登録設計

## 薬マスタデータ（medications.json）

- **件数**: 87件（JANコード検証済み）
- **カテゴリ数**: 18カテゴリ
- **データソース**: PMDA一般用医薬品データベース + 小売サイトからのJANコード検証
- **ファイル**: `backend/src/data/medications.json`（変更禁止）

### 対応カテゴリ

1. 解熱鎮痛薬（ロキソニンS、バファリン、イブ等）
2. 総合かぜ薬（パブロン、ルル、ベンザブロック等）
3. 胃腸薬（ガスター、太田胃散等）
4. アレルギー薬（アレグラ、アレジオン、クラリチン等）
5. 整腸剤（ビオフェルミン等）
6. 咳止め・去痰薬
7. 便秘薬
8. 下痢止