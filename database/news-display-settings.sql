-- Additive change: current articles and saved pagination/collection settings are preserved.
alter table public.site_settings
  add column breaking_threshold integer not null default 90 check (breaking_threshold between 0 and 100),
  add column breaking_max_age_hours integer not null default 24 check (breaking_max_age_hours between 1 and 720),
  add column pickup_threshold integer not null default 80 check (pickup_threshold between 0 and 100),
  add column pickup_max_articles integer not null default 3 check (pickup_max_articles between 1 and 12),
  add column publish_threshold integer not null default 80 check (publish_threshold between 1 and 100),
  add column no_article_threshold integer not null default 50 check (no_article_threshold between 0 and 99),
  add column date_highlight_hours integer not null default 24 check (date_highlight_hours between 0 and 8760),
  add column evaluation_guidelines text not null default 'ゲームを遊ぶ人にとって知りたい情報を最優先する
新作発表、発売日、新情報、大型アップデート、DLC、体験版を高く評価する
ゲーム機本体や新しいハードウェアの情報を特に重視する
ゲームタイトルやIPの人気・注目度を考慮する
小規模な修正と大型コンテンツ追加を区別する
映画、イベント、グッズは基本的に優先度を大きく下げる
人気ゲームの大型映画化など話題性が高い情報は例外とする
決算や人事はゲームへの直接的な影響が大きい場合のみ高く評価する
Nintendo eShopなどの定期ランキングや定例の新着ソフト紹介は低く評価する。ただし、大規模セールや注目作の無料配信など、プレイヤーにとって重要な情報は例外とする
記事の種類だけでなく、本文の具体的な内容を読んで総合判断する' check (char_length(btrim(evaluation_guidelines)) between 1 and 6000),
  add constraint site_settings_publication_thresholds_check check (no_article_threshold < publish_threshold);
