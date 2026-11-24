# 認証付き情報取得API

専用Vercelプロジェクト ilovegame-source-probe（公開サイト ilovegame とは別）で利用する。Vercel Authentication の保護範囲は必ず All Deployments。公開サイト側にはこのAPIを接続しない。保護の無効化や例外登録をしない。

共通取得処理は `lib/source-evidence.js` とその依存ファイルを使用する。専用のエントリーポイントは `api/source-evidence.js` に `export {default} from '../lib/internal-source-evidence-handler.js';` を配置する（このファイルは公開サイトのAPIディレクトリには追加しない）。専用プロジェクトIDとproduction環境をランタイムで確認してから処理し、他環境では403。本文の応答は共有キャッシュに保存しない。通常Chatは接続済みVercelの認証経路を使い、秘密鍵を取得・保存・プロンプトに貼り付けない。

- 一覧: `/api/source-evidence?source=nintendo`（playstation、prtimes、xbox、steamも同様）
- 詳細: `/api/source-evidence?source=nintendo&id=<一覧ID>&include_text=1`（本文は明示した時だけ）
- 並列一覧: `/api/source-evidence?sources=nintendo,playstation,xbox,steam,prtimes`（登録済み情報源を最大5つ。各情報源の成功・失敗を個別に返す。詳細・本文取得との併用不可）

情報源の名称・一覧・ID・ページ制約は `lib/source-evidence-registry.js` が正本。Xboxは日本向けXbox Wire公式RSS、Steamは日本向け公式ストアの新作・発売予定の特集枠を取得する。Steamの一覧・詳細は `evidence_kind=store_listing` で、元発表日時は未確認（`published.value=null`）。発売日を発表日時として扱わず、常設情報は独自紹介にのみ利用する。Steam AppIDは正の32ビット整数に限定する。全ストア・全作品のニュースを網羅するAPIではない。Steamの動画は開発元提供の説明欄にあるYouTubeリンクを抽出し、oEmbedで確認する。ストア内のネイティブ動画はタイトル・公式ストアページを返す（直接MP4は返さない）。公式サイト候補・開発元・販売元、追加確認の要否も返し、収集役が一次情報を直接確認するための手掛かりとする。公式サイト候補をAPIが任意外部URLとして取得することはない。

元発表本文は内部編集の参考資料。翻訳・転載して公開せず、事実と自分の言葉による記事を作る。YouTube公式チャンネル・埋め込み許可・同一動画を確認し、独自配信は公式ページにリンクする。元URL・発表時刻を確認する。取得失敗は未完了として扱う。既存記事や定期タスク、DB構造に変更を加えない。保護状態はリリース前に確認し、未認証ブラウザでログインが要求されることを検証する。
