# ニュース画像の取得・表示

- 収集役はニュース本文・発表日時等の一次情報に集中し、画像を探索・保存しない。AI処理役が元記事のOG画像・本文画像、作品公式サイト・公式プレス素材、同一作品の公式ストア画像の順に候補を確認する。Xbox・Steamも同じ基準とする。
- 作品・発表内容との一致を確認し、実際にGETしてHTTP成功・image/*であることを確認したURLだけを保存する。ページURLや動画URLを画像URLにしない。
- 取得できないときは別の公式候補を確認し、それでも確認できなければ理由を記録して画像なしとする。無関係な画像は採用しない。
- 先頭画像・OG画像が不適切な場合も、同一の公式発表の本文内画像や公開画像一覧を確認する。対象作品単独の横長キービジュアルやゲーム画面を優先し、権利表記を保持する。直接参照の許諾が未確認なら、自サイト管理候補として出典を記録する。
- 未登録・取得不能・保存後に外部画像の配信が停止した場合、ニュース一覧・PICK UPは自社キャラクターの歩くコスモッチの共通画像（16:9）を表示する。これは作品画像の代替表示であり、公式画像としてDBに登録しない。BREAKING・詳細記事は壊れた画像を除去する。
- 既存記事の画像補完では本文・評価・公開状態を変更しない。
- IR・決算資料・統計などで元発表に画像がない場合も、中心作品の公式サイト、公式プレス素材、同一作品の公式ストアを順に確認する。複数作品なら中心作品を優先し、推測URLは使用しない。
- 作品の登録済み出典は `article_games.game_id` と `game_sources.game_id` を通じて確認する（`game_sources.url`、verified公式/store）。`games.source_url` は存在しない。
- AI処理役が画像の未取得・無効を確認し、代替画像を探索してから保存する。動画があるだけでサムネイル探索を省略しない。利用条件や作品との一致を確認できない画像は掲載せず、具体的な取得失敗理由を記録する。
- 編集室にはサムネイルなしの絞り込みだけを残し、手動再取得ボタンは設けない。

## メーカー別の画像利用条件（2026-11-25）

記録のないメーカーは未確認扱いとする。メーカー全体の許諾を推測せず、素材ごとの対象・用途・商用利用・必要なクレジット・利用期限・直接参照の可否を確認する。確認済みの条件は適用範囲内で再利用できる。条件変更や対象外素材では再確認する。

| 発行元 | 確認先 | 現時点の判定 |
| --- | --- | --- |
| Ubisoft | [Press Center](https://www.ubisoft.com/en-us/company/press)、[著作権素材の案内](https://www.ubisoft.com/ja-jp/help/article/000062649)、[作品公式クリエイタープログラム](https://www.mightandmagicfates.com/creator-program) | 認定メディア向け素材や登録者向け特典がある。動画ガイドラインは静止画の包括的許諾ではない。Might and Magic The Card Game のSteamカプセル自体は取得可能だが、ニュースサイトでの直接掲載条件は確認できていない。 |
| PR TIMES（発行企業の公式発表） | [利用規約・基本規約第3条(8)(12)、報道規約第2・3・6条](https://prtimes.jp/main/html/kiyaku)、[素材公開設定](https://tayori.com/q/PRTIMES-faq/detail/515732/)、[PIXTA例外](https://tayori.com/q/prtimes-faq/detail/722175/) | 報道目的で利用する者は登録の有無を問わず報道関係者の定義に含まれ、公開企業コンテンツ（付随画像を含む）の無償報道利用が規定される。個別発表の権利・公開範囲・解禁・クレジットを確認し、当該発表の報道記事とその一覧紹介に限定。PIXTA等の第三者素材、限定配信、広告への転用、対価を得る企業コンテンツ利用は除外。画像URLへの直接参照の独立した可否やサイト収益化との関係は規約だけで断定せず、該当条件を確認できる場合のみ採用。 |
| スクウェア・エニックス | [北米Press Hub](https://press.na.square-enix.com/)、[Press Site利用条件](https://press.na.square-enix.com/Site/TermsAndConditions) | 報道関係者への同社提供素材の報道掲載・複製・配布の明示許諾あり。地域・解禁・年齢区分・権利表記および利用資格を確認。ポータル外の素材や直接画像参照の可否に一般化しない。 |
| Microsoft | [著作権素材利用条件・Press節](https://www.microsoft.com/en-us/legal/intellectualproperty/copyright/permissions) | News Centerの画像は報道・分析用途に限定して利用可。第三者ロゴ・人物等の権利を別途確認。Xbox Wireや第三者ゲームの画像すべてへの許諾ではない。直接参照・個別条件は別途確認。 |
| Nintendo | [Press Portal利用条件](https://3d264ed804a5e3efdc04-7ea4f245e03c2336a863398439e89dea.ssl.cf3.rackcdn.com/NintendoPressPortal_legaltermsofuse.pdf) | 指定プレスポータル素材の報道・レビュー用途に限定した許諾あり。登録・利用資格、地域、第三者権利、広告・商用目的制限、改変禁止を確認。一般公式サイトの画像や直接参照は別扱い。認証を回避しない。 |
| Activision / Blizzard | [公式メディア窓口](https://www.activisionblizzard.com/media-contacts)、[Blizzard Press Center](https://blizzard.gamespress.com/)、[Diablo IV Season of Tyrael's Gambit素材](https://blizzard.gamespress.com/en/Diablo-IV-Season-of-Tyraels-Gambit) | 公式提供の報道素材を探す入口を確認。個別素材の使用条件と直接参照許可は未確認。素材一覧の存在だけで許諾扱いしない。 |
| Capcom | [米州Press Center登録](https://press.capcom.com/user/registration)、[動画方針](https://press.capcom.com/Video-Policy) | 米州向けポータル。日本は地域担当窓口を確認。動画方針を公式静止画の許諾へ転用しない。 |
| Klabater | [公式Press Kit](https://klabater.com/en/press-kit-assets/) | 同社配布のプレスキット素材は報道用途許諾が明記済み。対象作品・素材・個別条件を照合し、直接画像参照の可否は別途確認。 |
| Unruled Games（No Asteroids） | [作品公式Press & Creators](https://unruledgames.com/games/no-asteroids) | 公式プレスキットあり。動画・短いクリップの記事利用は明記されるが、静止画の利用条件および直接参照は未確認。 |
| Games Press（配信サービス） | [素材利用FAQ](https://www.gamespress.com/en-US/FAQ---Use-of-Assets) | 報道向けに権利者から提供された素材の確認先。配信元は権利保証をしていないため各素材の権利者側条件を確認し、包括許諾とは扱わない。 |

## 確認の優先順位

- 全メーカー共通：公式発表・公式プレスキットだけで適切な画像が見つからない場合、ファミ通、GAME Watch、4Gamer、AUTOMATON等のゲームニュース媒体を素材の発見元として確認する。出典・クレジット・公式発表リンクから原典の公式素材や正規報道配信（PR TIMES、WebWire等）へ遡り、作品一致・利用条件・必要な権利表記を確認する。媒体独自の撮影・制作・編集画像や記事側の画像URLは無断流用しない。直接参照条件を含む既存の公開用画像基準と手動自サイト管理条件を維持する。任天堂向けの報道配信探索手順も他メーカーに適用できる。
- 任天堂の記事では、公式発表の画像を使用できない場合、同じ発表を [WebWire](https://www.webwire.com/) 等の報道用プレスリリース配信サービスで確認する。原典・発行元・対象作品・報道用画像の明示・適用される利用条件を照合する。[WebWire出版社向け規約](https://www.webwire.com/ServTerms.asp) の報道利用・出典表示条件は該当するリリース素材に限定して適用し、任天堂の一般画像の包括許諾とは扱わない。直接参照が未確認なら自サイト管理候補として報告し、自動アップロードは行わない。
- 速報性を維持するため、報道用途と対象範囲が確認済みの公式素材は台帳の根拠を再利用し、同一条件下で記事ごとの個別申請・重複調査を行わない。条件変更や対象外の場合は再確認する。権利未確認の画像だけを理由に記事公開を遅らせず、代替表示で補う。他媒体の転載画像は安易に流用しない。
- 公開ページの掲載方針と連携し、権利者の指摘を受けた場合は対象・権利関係を確認のうえ、速やかに修正・削除する。事後対応は事前の利用条件の代替ではない。
- 報道用途として公式に配布されるプレス素材を優先し、条件が明記された対象素材なら台帳の根拠を利用して重複調査を省略する。一般サイトのOG画像やストア画像への包括的許諾とは区別する。
- 画像自体の報道掲載条件と、現在の外部URL直接表示方式を区別する。ダウンロード・掲載が許可されていても直接参照の可否を確認できない場合は未確認のままとする。アクセス制限、期限付きURL、会員限定素材を回避しない。素材の出典と必要な権利表記を記録し、表示・加工制限を満たせない場合は採用しない。
- 台帳にないメーカーでも公式プレスキットの個別規約を確認し、明示された権利・対象・用途・直接参照条件が揃う場合は採用可能。台帳の未登録自体を禁止と混同しない。

画像候補が存在するが利用条件が未確認の場合は「権利条件未確認」、技術的に取得できない場合は「取得不能」、適切な画像が見つからない場合は「素材なし」と区別して記録する。素材のURLと確認先は根拠として残す。公式画像が使えると確認できるまで、代替表示で補う。既存の公開判定は変更しない。

## 自サイト管理の報道素材（2026-11-25）

ユーザー承認済みの補完作業では、発行元が報道向けに公開配布し、報道掲載・複製が認められた素材は、直接参照の許可が未確認でも、その許諾範囲内でダウンロードし、当サイトの静的素材として管理できる。個別の制限、第三者素材、解禁、必要な表記を確認し、満たせない素材は採用しない。原画像の内容・比率・権利表記を維持し、必要な表示サイズへの縮小と形式変換のみ。記事本文や評価、公開状態は変更しない。外部直接参照の制限回避には使わない。定期タスクによる自動アップロードは本手順の対象外。

### 補完記録

根拠は [PR TIMES報道規約第3条・基本規約第3条](https://prtimes.jp/main/html/kiyaku) と各企業の公開プレスリリースの素材配布案内。2026-11-25確認。以下は各発表の報道記事・一覧用のみ、画像の権利は各権利者に帰属する。

| 記事ID | 発行元・作品 | 素材の出典 | 管理パス |
| --- | --- | --- | --- |
| 581 | taskey / Midnight Toybox | [公式発表・メディア向けプレスキット案内](https://prtimes.jp/main/html/rd/p/000000206.000012747.html) | assets/editorial-thumbnails/581.webp |
| 582 | Qdan / みんなでダンダンティアー！ | [公式発表・報道素材ダウンロード案内](https://prtimes.jp/main/html/rd/p/000000033.000108704.html) | assets/editorial-thumbnails/582.webp |
| 583 | Pocketpair Publishing / Normal Fishing | [公式発表・公開報道素材](https://prtimes.jp/main/html/rd/p/000000171.000071410.html) | assets/editorial-thumbnails/583.webp |
| 590 | カバー / Aiming・ホロじゃん | [公式発表・画像使用時のクレジット案内](https://prtimes.jp/main/html/rd/p/000001291.000030268.html)（画像内の © COVER © Aiming Inc. を保持） | assets/editorial-thumbnails/590.webp |
| 595 | ジュピター・ピクロスS CLIMAX | [公式発表の本文内別画像](https://prtimes.jp/main/html/rd/p/000000047.000130182.html)（画像内の ©2026 Jupiter・商標表記を保持） | assets/editorial-thumbnails/595.webp |

### Square Enix Press Hub報道素材（2026-11-26）

記事603： [公式November Screenshots（2026-11-25）](https://press.na.square-enix.com/Items/Details/Romancing-SaGa-3-Destinies-United?focusOnFileCollectionId=November-Screenshots-98053) の `RS3R_20261125_PUB_03_Undine.png`（1920×1080）。[Press Site Terms of Use](https://press.na.square-enix.com/Site/TermsAndConditions) の報道関係者向け掲載・複製許諾に基づき、当該ゲームの記事の紹介に限定。公開ダウンロードで取得し、個別の地域・解禁の制限表示なし。権利表記 © SQUARE ENIX を記事に記載し、内容・比率を維持して縮小・形式変換のみ実施。管理パス：`assets/editorial-thumbnails/603.webp`。一般公式サイトの画像の利用許諾とは区別する。

### 編集部イメージ

記事579の旧代替画像は当サイト独自のコスモッチのレースイラスト、記事578・584・585・587・588はニュースのテーマを示す独自の図案。公式画像や実際のゲーム画面ではない。後者は画像内に「編集部イメージ」と明記し、公式ロゴやスクリーンショットを転用しない。利用条件が確認できた公式素材があれば、そちらに差し替え可能。

### WebWire報道素材（2026-11-26）

記事579： [WebWireのリリース](https://www.webwire.com/ViewPressRel.asp?aId=364658) に Press Release Image として明示された画像を使用。原典へのリンクは任天堂米国公式発表。 [WebWireの出版社向け利用規約](https://www.webwire.com/ServTerms.asp) は同サービスのリリースの報道・出版用途での再利用を出典表示条件付きで認める。今回のリリース添付画像に限定し、出典WebWire・© Nintendoを記事に表示する。任天堂からの個別許諾は未取得で、任天堂一般サイト素材への包括許諾ではない。画像の内容・比率を維持した形式変換のみ。管理パス: `assets/editorial-thumbnails/579-press.webp`。
