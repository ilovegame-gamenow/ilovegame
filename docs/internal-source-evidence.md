# 認証付き情報取得API

専用Vercelプロジェクト ilovegame-source-probe（公開サイト ilovegame とは別）で利用する。Vercel Authentication の保護範囲は必ず All Deployments。公開サイト側にはこのAPIを接続しない。保護の無効化や例外登録をしない。

共通取得処理は `lib/source-evidence.js` とその依存ファイルを使用する。専用のエントリーポイントは `api/source-evidence.js` に `export {default} from '../lib/internal-source-evidence-handler.js';` を配置する（このファイルは公開サイトのAPIディレクトリには追加しない）。専用プロジェクトIDとproduction環境をランタイムで確認してから処理し、他環境では403。本文の応答は共有キャッシュに保存しない。通常Chatは接続済みVercelの認証経路を使い、秘密鍵を取得・保存・プロンプトに貼り付けない。

- 一覧: `/api/source-evidence?source=nintendo`（playstation、prtimesも同様）
- 詳細: `/api/source-evidence?source=nintendo&id=<一覧ID>&include_text=1`（本文は明示した時だけ）

元発表本文は内部編集の参考資料。翻訳・転載して公開せず、事実と自分の言葉による記事を作る。YouTube公式チャンネル・埋め込み許可・同一動画を確認し、独自配信は公式ページにリンクする。元URL・発表時刻を確認する。取得失敗は未完了として扱う。既存記事や定期タスク、DB構造に変更を加えない。保護状態はリリース前に確認し、未認証ブラウザでログインが要求されることを検証する。