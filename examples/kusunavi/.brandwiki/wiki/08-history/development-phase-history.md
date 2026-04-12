---
title: 開発フェーズ履歴
category: 08-history
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/archive/continuefrom.md, raw/notes/archive/next-phase-plan.md, raw/notes/archive/detailedstepplan.md]
---

# 開発フェーズ履歴

## V0〜V2: 機能開発フェーズ（105/105タスク完了）

全V0〜V2のタスクが完了済み。詳細は `raw/notes/archive/detailedstepplan.md` 参照。

| ステップ | 内容 | 状態 |
|---------|------|:----:|
| Step 0-1 | プロジェクト初期セットアップ | ✅ |
| Step 0-2 | 認証・ユーザー管理 | ✅ |
| Step 0-3 | 家族プロフィール | ✅ |
| Step 0-4 | 健康プロフィール | ✅ |
| Step 0-5 | 薬マスタ・薬登録 | ✅ |
| Step 0-6 | 薬一覧・詳細・編集 | ✅ |
| Step 0-7 | ホーム画面 | ✅ |
| Step 0-8 | 通知・設定 | ✅ |
| Step 1-1 | 判定ルール基盤 | ✅ |
| Step 1-2 | 問診フロー | ✅ |
| Step 1-3 | 判定エンジン | ✅ |
| Step 1-4 | 判定結果表示 | ✅ |
| Step 1-5 | 安全ルール統合テスト | ✅ |
| Step 2-1 | 服用記録 | ✅ |
| Step 2-2 | 症状相談履歴・再相談 | ✅ |
| Step 2-3 | 通知強化 | ✅ |

## プロダクション準備フェーズ（Phase 1〜6 完了）

| Phase | 内容 | 状態 |
|-------|------|:----:|
| Phase 1 | Supabase Storageへの写真アップロード移行 | ✅ 完了 |
| Phase 2 | Supabase Auth移行（カスタムJWT → Supabase Auth） | ✅ ほぼ完了（Anonymous Sign-In有効化待ちのみ） |
| Phase 3 | Railwayへのバックエンドデプロイ | ✅ 完了 |
| Phase 4 | OTC薬マスタデータ整備（87件、JANコード検証済み） | ✅ 完了 |
| Phase 5 | 実機テスト・UXポリッシュ | ✅ 完了 |
| Phase 6 | 未決定設計事項の確定 | ✅ 完了 |

## データベースアーキテクチャ進化（Phase 1〜5）

`raw/notes/planning/architecture-review.md` で設計・実装済み：

| Phase | 内容 |
|-------|------|
| Phase 1 | FamilyMemberアーキテクチャ進化（アカウントなしメンバー対応） |
| Phase 2 | 薬オーナーシップモデル + Reminderモデル追加 |
| Phase 3 | 監査ログ（recordedByUserId / InventoryEvent） |
| Phase 4 | FamilyGroupロール・権限強化 |
| Phase 5 | 通知アーキテクチャ刷新（NotificationEvent + NotificationRecipient分離） |

## 主要設計判断ログ

### 認証方式
- **決定**: カスタムJWT → Supabase Auth に移行
- **理由**: ソーシャルログイン対応・セッション自動更新・トークン永続化

### 写真保存
- **決定**: ローカル `/uploads` → Supabase Storage
- **理由**: クラウドデプロイへの対応

### ゲーミフィケーション
- **決定**: 実績/バッジ・成長システムを保留
- **理由**: 医療アプリのトーンに合わない。ストリーク依存は有害になりうる。「温かさ・振り返り・関係性」で代替（2026-04-12）

### オフライン対応
- **決定**: V1ではオフラインキャッシュは実装しない
- **理由**: 複雑度（キャッシュ無効化・同期競合）に対しユーザー価値が低い

### 処方薬
- **決定**: 在庫管理のみ許可。症状相談の推薦対象外
- **理由**: 安全性の観点

### 写真スキャン認識方法
- **決定**: バーコード(JAN)スキャンを主要フロー。OCRはフォールバック
- **理由**: OCR単独では精度不足

## 現在のバージョン（TestFlight提出時点）

- アプリバージョン: v1.37.0（build 7）
- frontend/package.json: 0.50.0
- backend/package.json: 0.56.0
- Expo SDK: 55

## 関連記事

- [[アーキテクチャ概要]]
- [[TestFlight提出・運用]]