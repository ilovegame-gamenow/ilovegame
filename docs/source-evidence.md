# 公式情報取得基盤（Chat連携）

既存の収集・AI処理・DB更新とは独立したGET専用API。外部生成AI APIは使用しない。

- `/api/news?resource=source-evidence&source=nintendo&page=1`：任天堂の一覧（ページ1〜5）
- `/api/news?resource=source-evidence&source=playstation`：公式RSS（配信中の項目のみ）
- `/api/news?resource=source-evidence&source=prtimes`：公式コンシューマーゲームカテゴリ先頭ページ（未採点の発見入口）
- `/api/news?resource=source-evidence&source=nintendo&id=一覧のid`：元記事の日時・タイトル・画像・動画の根拠

記事は明示した3ソースの正規IDのみを受け付け、任意URL・リダイレクトは取得しない。画像は登録済みの公式配信ホストのみ実際の応答を確認する。失敗を記事なしと混同しない。公開データはメタ情報のみ。本文全文は認証済みの内部利用向け `include_text=1` のみで返す（専用秘密値 SOURCE_EVIDENCE_SECRET が設定され、適切な認証経路が確立した場合）。秘密値をChatのプロンプトに貼らない。本文はキャッシュしない。公開メタ情報のキャッシュは5分。

PR TIMESの日時は公式の日本時間表記に従い、タイムゾーン未記載の秒精度の値をJSTとして変換する。任天堂のページに日付しかない場合は一覧JSONの日時を利用する。日付だけを時刻に推定しない。

動画は候補、公式ページへのリンク、未確認、検出なしを区別する。YouTubeのoEmbed結果は動画の存在・タイトル・投稿者・埋め込み情報の裏付けであり、同一動画や権利者、対象ドメインでの再生許可はChatが確認する。直接MP4・期限付き動画URLは掲載しない。独自動画は同じ公式YouTube動画を探し、なければ公式ページへのリンクを使う。無関係・非公式転載動画は掲載しない。

本APIは記事生成・採点・登録・公開・DB変更を一切行わない。収集側の重複条件・24時間制限・発表時刻確認・画像確認は維持する。