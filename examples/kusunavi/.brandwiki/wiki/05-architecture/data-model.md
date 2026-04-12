---
title: データモデルとファミリー進化
category: 05-architecture
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__planning__architecture-review.md, raw/notes/notes__planning__notification-improvement.md]
---

# データモデルとファミリー進化

## 主要エンティティ

| エンティティ | 役割 |
|---|---|
| `User` | 認証済みアカウント |
| `FamilyGroup` | 家族グループ（複数Userを含む） |
| `FamilyGroupMembership` | UserとFamilyGroupの中間（role: owner/admin/member） |
| `FamilyProfile`（≒ FamilyMember） | 家族の1人。account有無を問わず作れる |
| `Guardian` | FamilyProfile に複数つけられる保護者（User） |
| `HealthProfile` | FamilyProfileに紐づく健康情報 |
| `MedicationMaster` | 薬マスタ（参照情報） |
| `HouseholdMedication` | 家庭内に実在する薬在庫 |
| `Reminder` | 薬の服用リマインダースケジュール |
| `IntakeLog` | 服用記録（consumer = FamilyMember、recorder = User） |
| `InventoryEvent` | 在庫変動の監査ログ |
| `SymptomSession` | 症状トリアージセッション |
| `RecommendationResult` | セッションの判定結果 |
| `NotificationEvent` | 通知イベント（共通） |
| `NotificationRecipient` | 通知の配信先（受信者ごと） |
| `NotificationPreference` | ユーザーごとの通知種別ON/OFF |

## 重要な分離原則

- **薬マスタ ≠ 家庭内在庫** — 公式情報更新と家庭在庫情報を分離
- **FamilyMember ≠ User** — 子ども・高齢者などアカウントを持たない家族も管理可能
- **NotificationEvent ≠ NotificationRecipient** — 1イベント多受信者、独立した既読状態

## ファミリー構造の例

```
山家ファミリー（FamilyGroup）
├── 母（User + FamilyProfile）— Group owner
├── 父（User + FamilyProfile）
├── 長男（User + FamilyProfile）
└── 次男（FamilyProfile only、guardians = 母, 父）
```

## 薬の所有モデル

`HouseholdMedication.ownerType`:

| ownerType | 配信ルール |
|---|---|
| `family_member` | そのメンバーの guardians に通知 |
| `family_group` | グループの全 User に通知 |

## 通知の dedup キー（6フィールド）

```
type + targetType + targetId + relatedEntityId + stage + recipientUserId
```

`relatedEntityId` を含めることで、同じステージで2つの異なる薬が衝突しないようになっている。

## ファミリー進化の実装フェーズ

詳細は [[notification-system]] 参照。

| Phase | 内容 |
|---|---|
| Phase 1 | FamilyMember Evolution — `linkedUserId` nullable化、`familyGroupId`、`status` 追加 |
| Phase 2 | Reminders + ownerType — Reminder model 追加 |
| Phase 3 | Audit Trail — `recordedByUserId`、`InventoryEvent`、`createdByUserId` |
| Phase 4 | FamilyGroup Roles & Permissions — owner/admin/member、ownership 移譲 |
| Phase 5 | Notification Architecture Upgrade — Event + Recipient 分割 |

## ソフト削除戦略

`isActive` / `archivedAt` / `status` を使用。歴史的レコード（IntakeLog、Notification、SymptomSession）を保護するため、`MedicationInstance` と `FamilyMember` は **ハード削除しない**。

## 監査フィールド

- `createdByUserId`
- `updatedByUserId`
- `recordedByUserId`

例: 子の IntakeLog で `recordedByUserId = mother`。

関連: [[architecture-backend]]、[[notification-system]]、[[health-profile]]