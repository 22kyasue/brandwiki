---
title: TestFlight提出・運用
category: 07-operations
status: draft
confidence: high
updated: 2026-04-11
sources: [raw/notes/testflight-remaining-actions.md, raw/notes/testflight-review-submission.md]
---

# TestFlight提出・運用

## 対象バージョン

- アプリバージョン: v1.37.0（build 7）
- 提出先: App Store Connect > TestFlight > 外部テスト Beta App Review

## 提出ステータス（2026-04-12時点）

コード・コンテンツ作業は**100%完了**。残るは手動作業のみ。

| タスク | 状態 |
|-------|:----:|
| A. GitHub Pages でウェブポリシー公開 | ⏳ 未完 |
| B. App Store ConnectにプライバシーポリシーURL登録 | ⏳ 未完 |
| C. EAS Production Build | ⏳ 未完 |
| D. TestFlight アップロード | ⏳ 未完 |
| E. Beta App Review 提出 | ⏳ 未完 |

## 推奨実行順序

```
1. A（GitHub Pages公開）→ URL取得
2. B（App Store Connect設定）← Aで取得したURL使用
3. C（EAS Build）← バックグラウンド実行
4. D（eas submit）← Cのビルド完了後
5. E（Beta App Review提出）← Dの処理完了後
```

推定所要時間: **操作約60分 + 待機2時間**

## ビルド・提出コマンド

```bash
cd frontend
eas build --platform ios --profile production
eas submit --platform ios --latest
```

## URLの管理

| 項目 | URL |
|------|-----|
| プライバシーポリシー | `https://22kyasue.github.io/kusunavi/privacy.html` |
| 利用規約 | `https://22kyasue.github.io/kusunavi/terms.html` |
| バックエンド | `https://kusunavi-production.up.railway.app` |

## Beta App Description（テスター向け）

主な機能:
- 家族全員のお薬を一元管理（OTC医薬品・処方薬）
- 飲み合わせ（相互作用）と重複投薬の自動チェック
- 症状に合わせたお薬の情報提供と受診勧奨
- 処方薬の添付文書情報の検索
- AI薬剤師チャットによる一般的な医薬品相談
- 服薬リマインダーと期限切れ通知
- お薬手帳OCRとバーコードスキャンで登録を簡単に

## Apple Reviewer向けテストアカウント

- **推奨方法**: ゲストログイン（「ゲストとして始める」をタップ）
- **代替**: `test-review@kusunavi.app` / `TestReview2026!`

## App Privacy申告（Nutrition Label）

| カテゴリ | 項目 | 利用目的 |
|---------|------|---------|
| Contact Info | Email Address | App Functionality, Account |
| Contact Info | Name | App Functionality |
| Health & Fitness | Health（機微データ） | App Functionality |
| User Content | 症状・チャット履歴 | App Functionality |
| Identifiers | User ID | App Functionality |

第三者トラッキング: **なし**

## 輸出コンプライアンス

HTTPS/TLSのみ使用。標準暗号化のみで年次自己分類レポート不要。

## アカウント削除（Guideline 5.1.1(v)準拠）

設定 > アカウントを削除 → 確認

削除対象:
- プロフィール情報
- 登録済み薬
- 服薬履歴
- 家族メンバー
- 症状・チャット履歴

Supabase Auth削除を先に実行し、その後データベースクリーンアップ。

## 想定される却下理由と対策

| 却下理由 | 対策 |
|---------|------|
| 医療免責不足 | ConsentScreen + HelpScreenに強化版免責を配置済み |
| アカウント削除なし | 実装済み（バックエンド＋フロント＋テスト完備） |
| プライバシーポリシーURL欠落 | GitHub Pagesで公開しApp Store Connectに登録 |
| AI生成コンテンツの免責不足 | Terms Article 2 および HelpScreen disclaimerに明記 |

## 医療免責文言

```
この情報は一般的な参考情報です。医師の診断や処方の代わりとなるものではありません。
症状が重い場合や改善しない場合は、必ず医療機関を受診してください。
薬を使用する前に、必ず添付文書をお読みください。
```

## 関連記事

- [[アーキテクチャ概要]]
- [[開発フェーズ履歴]]