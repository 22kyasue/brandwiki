---
title: 通知システム
category: 05-architecture
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/notes__planning__notification-improvement.md, raw/notes/notes__planning__architecture-review.md]
---

# 通知システム

家族中心の通知配信。Phase 1〜5 の段階的な実装を経ている。

## 通知種別

| Type | 用途 |
|---|---|
| `expiration` | 使用期限 |
| `low_stock` | 残数不足 |
| `intake_reminder` | 服用リマインダー |
| `reconsult_prompt` | 再相談促し |

## ステージベース dedup

通知は「平坦な繰り返しイベント」ではなく **ステージベース** で扱う。

### Expiration ステージ
`30d` / `7d` / `1d` / `expired`

### Low stock ステージ
`entered_threshold` (≤3) / `critical_1` (=1) / `out_of_stock` (=0)

### Reconsult ステージ
`3d` / `7d` / `14d`

### Reminder ステージ
slot-based（時刻別）

## Dedup キー（6フィールド）

```
type + targetType + targetId + relatedEntityId + stage + recipientUserId
```

`relatedEntityId` を含めることで異なる薬が同ステージで衝突するのを防ぐ。

## 通知ライフサイクル

```
pending → delivered → read → resolved
```

| 状態 | 意味 |
|---|---|
| `pending` | 作成済みだが未配信（quiet hours queue） |
| `delivered` | push／in-app 送信済み |
| `read` | ユーザーが見た |
| `resolved` | 元の問題が実際に解消された |

**重要**: `read` ≠ `resolved`。「通知を見た」と「問題が解消した」は別。

## 反応的解決（Reactive Resolution）

ポーリングではなく、サービスで即座に解決:

| トリガー | 解決対象 |
|---|---|
| `medication.update()` 期限変更 | 該当の expiration 通知 |
| `medication.update()` 残数増加 | 該当の low_stock 通知 |
| `medication.remove()` | その薬の全通知 |
| `intake.create()` | 該当の intake_reminder 通知（全 guardian） |
| `symptomSession.create()` | 該当の reconsult_prompt 通知 |

## Quiet Hours

`User.quietHoursStart` / `quietHoursEnd` / `timezone` を使用。Quiet hours 中の通知は **ドロップせず queue**:

- `status = pending` + `scheduledFor = quiet hours end`
- 15分ごとの delivery job が pending を delivered に変換
- **critical priority は quiet hours をバイパス**

## Priority-based Throttling

| Priority | ルール |
|---|---|
| `critical` | 常に即時配信 |
| `high` | max 1/type/hour |
| `normal` | max 1/type/day |
| `low` | 日次ダイジェストにバッチ |

## Guardian モデル

- 1 FamilyMember に複数 guardian を許可
- 各 guardian が自分の通知レコードを受け取る（read状態は独立）
- ある guardian がアクションを取ると、関連通知が **全 guardian で resolve**

例: 父が intake をログ → 母と父の両方の reminder 通知が resolved になる

## Household 通知

`MedicationInstance.ownerType = family_group` の場合、グループ全 User に配信。

## NotificationEvent / NotificationRecipient 分割（Phase 5）

| Table | 役割 |
|---|---|
| `NotificationEvent` | イベントの同定（type, targetType, targetId, relatedEntityId, stage） |
| `NotificationRecipient` | ユーザーごとの配信ステータス（status, deliveredAt, readAt, resolvedAt） |

`@@unique([notificationEventId, recipientUserId])` で重複配信を防止。API レスポンスシェイプは変えていない（フロントエンド変更不要）。

## 既存問題の解消

| 問題 | 解消 |
|---|---|
| 設定が永続化されない | `NotificationPreference` テーブル追加（Phase 1） |
| 受信者モデルが単純すぎる | Guardian モデル追加（Phase 2） |
| Quiet hours で通知ロスト | scheduledFor + queue で保証（Phase 3） |
| 1 dedup キーで衝突 | 6 フィールドキー（Phase 1） |

関連: [[data-model]]、[[architecture-backend]]