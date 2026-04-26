# パーソナルウィキ + Hadi プロジェクト 引き継ぎ

> **読み手へ**: このドキュメントは、「個人の人生まるごとを記録 + AI コーチ "Hadi" が話しかけてくる」プライベートシステムの設計記録です。会話で決めた全仕様を保存し、PC を切り替えても続きから再開できるようにする目的。新しい Claude Code セッションがこれを読んだら、決定事項を尊重して Phase 2 の構築に進んでください。

---

## 1. プロジェクト意図（要約）

ユーザーの要望:

- 自分に関する **ありとあらゆる情報を保存**したい（やったこと、思ったこと、筋トレ、食事、PR、目標、PC作業、Claude Code エージェントからのメッセージ、etc.）
- それを元に **目標達成を手助け**してくれる
- **見失いそうな時に助けてくれる**
- **アドバイスをくれる、たまに厳しいことも言ってくれる**
- **Jarvis のように喋れる**（音声）
- **誰にも見られたくない**（=「漏れたら世界の終わり」と最初は表現、後に脅威モデルを「周りの人 + ヤバいやつだけローカル」に緩和）

要するに「自分専用の第二の脳 + 内なるメンターの外在化」。

コーチには名前が付けられた: **Hadi（本名 Hadibabli）**。中身は Claude。

---

## 2. アーキテクチャ（2 リポ構成）

| リポ | 性質 | 役割 |
|---|---|---|
| `22kyasue/brandwiki` (= このリポ) | 公開 / MIT | エンジン本体。OSS として誰でも使える。Phase 1 で adapter フック類を追加済み |
| `22kyasue/hadi` (= 未作成、private) | 非公開 / ライセンスなし | Hadi 本体。暗号化、Hadi 人格、音声、個人テンプレ拡張、人生コーチング機能。`brandwiki-engine` を npm 依存で取り込み、上に被せる |

**この分離により**: brandwiki は OSS として綺麗に保たれ、Hadi は private で安全に育つ。コードコピペは発生しない。

---

## 3. 確定仕様（ロック済み — 再議論しない）

| 項目 | 決定 |
|---|---|
| **リポ構成** | brandwiki（公開）+ hadi（非公開）の 2 リポ。npm 依存で繋ぐ |
| **LLM 使い分け (Q2)** | C ハイブリッド: 通常カテゴリ = Anthropic（Claude、賢さ取る）、機微カテゴリ = Ollama（ローカルのみ） |
| **パスワード救済 (Q3)** | 紙運用。初回セットアップで復旧コードを 1 度だけ表示、紙に書いて金庫等に保管。忘れた + 紙紛失 = 終わり |
| **auto-lock (Q4)** | 15 分 idle で自動ロック |
| **音声プライバシー (Q5)** | A: 最高品質優先。ElevenLabs 等クラウド TTS 利用 OK（漏れる分は許容）。**ただし API 料金が高すぎたら後で hybrid/strict に切替できるよう config 化必須** |
| **Hadi 呼び出し (Q6)** | wake word + push-to-talk **両対応**。デフォルト = push-to-talk。常時聴取は明示的にオプトイン |
| **コーチ名** | Hadi（フルネーム Hadibabli）。`config.coach.name` で後で変更可 |
| **コーチ口調** | 固定しない。`config.coach.tone` で warm / harsh / sensei / flat 等を切替。カスタムプロファイル追加可。声の選択も口調プロファイルに紐づく |
| **言語** | 日本語デフォルト |
| **カテゴリ** | 17 個（下記参照）。`sensitivity: "private" | "normal"` フラグでローカル LLM 強制を制御 |
| **デフォルト private カテゴリ（暫定）** | `00-compass` / `06-journal` / `15-promises`（**ユーザーの最終確認待ち**） |
| **流入経路** | `brandwiki append`（公開鍵暗号化、書けるが読めない）+ Claude Code stop hook（オプトイン）+ shell エイリアス + iOS Shortcuts 等 |
| **設置場所** | `~/.personal-brandwiki/`（ホーム直下、プロジェクト内に置かない） |

### 脅威モデル（更新後 — 過剰防衛は降ろした）

| 脅威 | 守るか |
|---|---|
| 隣の人に画面のぞかれる | ✅ パスワード（短くてOK） |
| 友達/恋人に Mac 触られる | ✅ パスワード |
| ノート PC 紛失 | ✅ macOS FileVault に乗っかる（OS 標準） |
| Anthropic に普通の話が見える | ⚠️ 許容（賢さ取る） |
| Anthropic に **本当にヤバい話**が見える | ❌ ローカル LLM 限定（sensitivity=private カテゴリ） |
| 国家機関 / マルウェア | ❌ そこまで守らない |

**結果**: 当初想定していた age 個別暗号化 + Argon2id + tmpfs 展開はオーバーキル。FileVault + 軽いパスワード層 + ファイル権限で実用十分。`--paranoid` フラグで重武装モードに切替可能、という設計に格下げ。

---

## 4. カテゴリ仕様（17 個）

`templates/personal/config.json` に既に commit 済み。

| ID | タイトル | 機微度（暫定） |
|---|---|---|
| 00-compass | 羅針盤（ビジョン、Why、絶対ルール） | **private** |
| 01-identity | 自分（価値観、性格、強み弱み） | normal |
| 02-goals | 目標（10年/5年/年/Q/月/週） | normal |
| 03-fitness | 身体（ワークアウト、PR、体組成） | normal |
| 04-nutrition | 食事 | normal |
| 05-health | 健康（睡眠、気分、メンタル、薬） | normal |
| 06-journal | 日記・思考（生の感情） | **private** |
| 07-learning | 学び（本、コース、insight） | normal |
| 08-work | 仕事（キャリア、プロジェクト） | normal |
| 09-creative | 創作（副業、アイデア） | normal |
| 10-people | 人（関係、会話、贈り物） | normal |
| 11-money | お金 | normal |
| 12-time | 時間（習慣、ルーティン） | normal |
| 13-memories | 思い出 | normal |
| 14-patterns | 自分のパターン（トリガー、癖） | normal |
| 15-promises | 自分との約束（守った/破った） | **private** |
| 16-pc-activity | PC作業ログ | normal |

---

## 5. Phase 1 の状態（完了 / このリポにマージ済み）

ブランチ `claude/personal-brand-wiki-gelYT` の commit `1aad520` で push 済み。

含まれるもの:

- ✅ `templates/personal/config.json` — 17 カテゴリ
- ✅ `templates/personal/daily-template.md` — 毎日埋めるテンプレ
- ✅ `src/commands/append.ts` + CLI 登録 — 書き込み専用 inbox
- ✅ `src/lib/ollama.ts` — ローカル LLM 対応
- ✅ `BRANDWIKI_DIR` env var サポート — Hadi が tmpfs/別パスを指せる
- ✅ README 更新

これらは OSS として公開しても安全な汎用拡張。

---

## 6. Phase 2 計画（hadi private repo で構築）

ユーザーが `22kyasue/hadi` private repo を作成したら、そこに以下を実装:

### 6.1 セキュリティ層

- マスターパスワード設定（Argon2id KDF、ただし軽量パラメータでも可）
- 復旧コード生成（初回 1 度だけ表示、紙運用）
- `hadi unlock` / `hadi lock` ライフサイクル
- 15 分 idle で auto-lock
- 暗号化方式: **デフォルト軽量モード**（FileVault 前提、ファイル権限 + 簡易対称暗号 or プレーン + ロック画面）/ `--paranoid` で age 個別暗号化 + tmpfs 展開
- pre-flight チェック: 設置先が iCloud/Dropbox/git remote 配下なら拒否

### 6.2 LLM ハイブリッドルーティング

- カテゴリの `sensitivity` を見て:
  - `private` → Ollama 強制
  - `normal` → 設定に従い Anthropic
- 個別記事の frontmatter で上書き可能（`sensitivity: private`）
- `hadi mark-private <path>` / `hadi sensitivity <category> --set private` コマンド

### 6.3 Hadi 人格（コーチ層）

- `hadi` コマンド (= `brandwiki coach` 的な位置付け、ただし別バイナリ)
- サブコマンド:
  - `hadi`（引数なし） — デイリーチェックイン: 最近の journal 読んで 1 つ問いを投げる
  - `hadi --ask "..."` — 任意の相談
  - `hadi --tone harsh` — 一時的に厳しいモード
  - `hadi --tone-set warm` — デフォルト口調変更
  - `hadi --tone-add yankee "..."` — カスタム口調プロファイル追加
  - `hadi --compass` — 迷子モード: 00-compass 音読 + 現状とのギャップを示す
  - `hadi --review weekly` — 週次レビュー: 約束 vs 実態
  - `hadi --celebrate` — 良かったこと拾い上げ
- 口調プロファイル: `templates/personal/coach-prompts/{warm,harsh,sensei,flat,...}.md`
- system prompt 冒頭固定: 「あなたは Hadi（本名 Hadibabli）。中身は Claude。口調は config から動的読み込み」

### 6.4 音声層（Jarvis モード）

- TTS:
  - デフォルト: ElevenLabs（最高品質、A 選択）
  - フォールバック: Piper / Kokoro（ローカル、料金がヤバい時用）
  - `config.voice.provider` で切替
- STT: whisper.cpp（ローカル、Apple Silicon で sub-second）
- Wake word: Porcupine（オプトイン）
- コマンド:
  - `hadi --voice "..."` — 応答を音声で
  - `hadi listen` — 1 回マイク入力 → 文字起こし → 応答
  - `hadi voice` — push-to-talk 連続モード
  - `hadi voice --enable-always-on` — 常時聴取（オプトイン、要明示）
- 口調 × 声マッピング: 口調プロファイルに `voice` フィールド付与

### 6.5 流入経路

- `hadi append` (engine の `brandwiki append` をラップ、必要なら公開鍵で暗号化してから書く)
- Claude Code stop hook テンプレ: `templates/hooks/personal-wiki-stop.sh`
  - セッション終了時に「今日 PC で何をやったか」を Claude に要約させて `hadi append` に流す
  - **ユーザーが手動で `~/.claude/settings.json` に追加する形**（自動インストールしない＝事故防止）

### 6.6 漏洩防止ガード

- `serve` は `127.0.0.1` のみバインド + Basic 認証
- `research` / `fetch`（外向きネット）コマンドを `private: true` 時に拒否
- init 完了時に Claude Code 設定スニペットを表示:
  ```json
  "permissions": {
    "deny": ["Read(~/.personal-brandwiki/**)", "Edit(~/.personal-brandwiki/**)", "Write(~/.personal-brandwiki/**)"],
    "allow": ["Bash(brandwiki append*)", "Bash(hadi append*)"]
  }
  ```

### 6.7 ディレクトリ構造（hadi repo 想定）

```
hadi/
├── package.json (depends on brandwiki-engine via git URL or npm)
├── src/
│   ├── cli.ts                 # `hadi` バイナリ
│   ├── commands/
│   │   ├── unlock.ts / lock.ts / init.ts
│   │   ├── coach.ts           # Hadi 人格層
│   │   ├── voice.ts / listen.ts / speak.ts
│   │   └── mark-private.ts / sensitivity.ts
│   ├── crypto/
│   │   ├── lite.ts (デフォルト軽量モード)
│   │   └── paranoid.ts (age + Argon2id 重武装)
│   ├── llm/
│   │   └── hybrid-router.ts   # sensitivity → Ollama or Anthropic
│   ├── voice/
│   │   ├── tts.ts (ElevenLabs / Piper / Kokoro)
│   │   ├── stt.ts (whisper.cpp)
│   │   └── wake.ts (Porcupine)
│   └── coach/
│       ├── hadi.ts
│       └── prompts/{warm,harsh,sensei,flat,compass,daily,review,celebrate}.md
└── templates/
    └── hooks/personal-wiki-stop.sh
```

---

## 7. ユーザーへの未回答質問（Phase 2 着手ブロッカー）

**PC で再開時、これに答えてもらってから Phase 2 着手:**

1. **macOS FileVault は有効？**（システム設定 → プライバシーとセキュリティ → FileVault）
   - 有効ならそのまま進む
   - 無効なら有効化推奨（数時間かかる、寝てる間が良い）

2. **`22kyasue/hadi` private repo を作成済み？**
   - 未作成 → ブラウザで `github.com` → New repository → Private → README 入れず Create
   - 作成済み → URL 共有してください

3. **デフォルト private カテゴリは `00-compass` / `06-journal` / `15-promises` の 3 つで OK？**
   - そのままなら「OK」
   - 追加削除あれば指示

---

## 8. Mac で再開する手順

### Step 1: brandwiki repo を Mac に持ってくる

```bash
cd ~/  # 好きな場所
git clone https://github.com/22kyasue/brandwiki.git
cd brandwiki
git checkout claude/personal-brand-wiki-gelYT
```

すでにあれば:

```bash
cd ~/path/to/brandwiki
git fetch origin
git checkout claude/personal-brand-wiki-gelYT
git pull
```

### Step 2: ビルド + グローバル化

```bash
npm install
npm run build
npm link
brandwiki --help    # append が末尾にあれば成功
```

### Step 3: 動作確認（捨て用、オプション）

```bash
mkdir -p ~/test-personal && cd ~/test-personal
brandwiki init --template personal --language ja
brandwiki append --from manual --type fitness "ベンチ 80kg x 5"
ls .brandwiki/raw/inbox/
cd ~ && rm -rf ~/test-personal
```

### Step 4: 本番の personal wiki を作る（後で hadi が乗る場所）

```bash
cd ~/  # ホーム直下
brandwiki init --template personal --language ja --name "personal" \
  --name "personal"  # → ~/.brandwiki ではなく好きな場所でOK
# ただし hadi の本番設置場所は ~/.personal-brandwiki/ を想定
```

> **注**: 暗号化と Hadi 人格が乗るのは Phase 2 以降。今は素の brandwiki としてしか動かない。本格運用は hadi repo ができてから。

### Step 5: 新しい Claude Code セッションで再開

Mac で:

```bash
cd ~/path/to/brandwiki
claude
```

セッションで「**パーソナルウィキ続き**」とか「**Hadi の続き**」と話しかければ、CLAUDE.md → このドキュメントを読んで、Phase 2 着手前の質問 3 点を聞いてくるはず。

---

## 9. 新しい Claude セッションへのプロンプト（コピペ用）

PC でセッション開始時、以下を貼ってもいい:

```
パーソナルウィキ + Hadi プロジェクトの続きをやりたい。
docs/HANDOFF.md を読んで、§7 の未回答 3 問について聞いてきて。
答えたら Phase 2 の hadi private repo セットアップに進んで。
```

---

## 10. 命名・口調メモ（参考、後で変更可）

- コーチ名: **Hadi**（呼びかけ）/ **Hadibabli**（フルネーム）
- 出力フォーマット案:
  ```
  Hadi › 最近 4 日 journal 読んだ。03-fitness の最終更新 2 週間前。
         02-goals に「週 4 ジム」って書いてあるけど、これどう説明する？
  ```
- 口調 default: **未指定**（warm 寄りが無難。ユーザーが触りながら調整する想定）

---

## 11. リスク・注意

- **パスワード忘失 + 復旧コード紛失 = データ消失**。バックアップ戦略は復旧コード紙運用 + macOS Time Machine（暗号化されたまま）に頼る
- **ElevenLabs API 課金**: A 選択の代償。月額が想定外なら hybrid に下げる。`config.voice.maxMonthlyCost` で上限設定する案もあり
- **常時聴取モード**を有効化したらマイク常時 ON、心理的負担 + 別レイヤーの脅威。デフォルト OFF を維持
- **claude-cli 経由 = Anthropic がデータ通過点**: これは A/C 選択の前提。ローカル限定にしたい場合は sensitivity=private カテゴリを増やす
