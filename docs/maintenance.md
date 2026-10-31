# 保守・検証

## ローカルとCI

Node.js 24で以下を実行する。依存パッケージや本番の認証情報は不要。

```sh
node --test tests/*.test.mjs
```

GitHub Actionsの「Tests」はPRとmainへのpushで同じテストを実行する。
公式サイトの実データを使う検証は、手動実行時に `live_sources` を有効にする。
外部サイトの一時障害を通常のCIから分離し、実サイトの確認処理もソースファイルで管理する。
これらの検証は記事登録・AI生成を行わない。

削除されたメーカー別APIのテストは、現在の `/api/collect-game-news` の共通テストへ移行済み。
Nintendo・PlayStationの項目変換、設定件数、1件制限、認証を検証する。

## 収集処理

`lib/news-sources.js` がメーカーの登録場所。
各収集モジュールは記事データの取得のみを行い、登録は `registerPendingArticle` に集約する。
`articles.source_url` の一意制約と `resolution=ignore-duplicates` により、
事前照会なしで登録する。既存記事の本文・掲載状態・日時は更新しない。
新規登録は1記事につきDB通信1回。競合以外の保存エラーを重複として扱わない。

## データ整理の確認記録（2026-11-01 JST）

- articles: 73件（掲載56件・非掲載17件）。
- 重複URL: 0件。
- タイトル「テスト」、自サイト名の収集元、example.com / example.org / localhostのURLに一致する候補: 0件。
- 下書き: 0件。親記事がない下書き: 0件。
- この調査では本番データの削除・スキーマ変更は行っていない。

非掲載記事も収集済みURLの記録なので、古いという理由だけで削除しない。
削除すると次回収集で再登録・AI再処理される可能性がある。

`site_settings.date_highlight_hours` は現在のコードでは未使用。
過去のSQLと旧プレビューとの互換性のため今回は残す。
`published_at` などの旧来の項目は日付表示のフォールバックやAPI応答でも使われており、削除しない。
