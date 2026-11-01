import { newsSources } from './news-sources.js';
import { SHOWCASE } from './game-source-previews.js';
import { MAX_RESEARCH_ITEMS } from './steam-discovery-source.js';
import { ESTIMATED_MAX_USD } from './game-research-ai.js';
// These are editorial expansion candidates, not enabled collectors or editable runtime settings.
const categoryLabels={platform:'主要プラットフォーム',japan:'国内メーカー・開発会社',global:'海外メーカー・スタジオ',discovery:'ストア・紹介イベント',social:'SNS・動画・コミュニティ'};
const plannedSources=[
  {id:'xbox',category:'platform',name:'Microsoft / Xbox',website:'https://news.xbox.com/ja-jp/',description:'Xbox Wire Japanの公式ニュース。次の主要プラットフォーム候補。'},
  {id:'capcom',category:'japan',name:'カプコン',website:'https://www.capcom.co.jp/',description:'主要作品・新作・更新の公式情報を収集する候補。'},
  {id:'square-enix',category:'japan',name:'スクウェア・エニックス',website:'https://www.jp.square-enix.com/game/',description:'公式の作品情報と機種別発売情報を収集する候補。'},
  {id:'bandai-namco',category:'japan',name:'バンダイナムコエンターテインメント',website:'https://www.bandainamcoent.co.jp/cs/catalog/',description:'公式ゲームカタログと新作情報を収集する候補。'},
  {id:'sega',category:'japan',name:'セガ',website:'https://www.sega.jp/game/',description:'ソニックなどの作品情報と、家庭用・PC向けの新作発表を確認する候補。'},
  {id:'konami',category:'japan',name:'コナミ',website:'https://www.konami.com/games/jp/ja/products/search/',description:'公式ゲーム一覧から作品情報・対応機種・発売予定を確認する候補。'},
  {id:'koei-tecmo',category:'japan',name:'コーエーテクモゲームス',website:'https://www.gamecity.ne.jp/products/',description:'公式の作品一覧・発売情報を確認する候補。複数ブランドの作品を扱います。'},
  {id:'fromsoftware',category:'japan',name:'フロム・ソフトウェア',website:'https://www.fromsoftware.jp/jp/products.html',description:'アクション・RPG作品の公式情報と新作・更新情報を確認する候補。'},
  {id:'ea',category:'global',name:'Electronic Arts（EA）',website:'https://www.ea.com/games?setLocale=en-us',description:'スポーツ・アクション・シミュレーションなどの公式作品情報を確認する候補。'},
  {id:'ubisoft',category:'global',name:'Ubisoft',website:'https://www.ubisoft.com/en-us/games',description:'Assassin’s CreedやRainbow Sixなどの作品発表・更新情報を確認する候補。'},
  {id:'rockstar',category:'global',name:'Rockstar Games',website:'https://store.rockstargames.com/view-all-games',description:'Grand Theft AutoやRed Dead Redemptionなどの公式作品情報を確認する候補。'},
  {id:'2k',category:'global',name:'2K',website:'https://newsroom.2k.com/games',description:'公式ニュースルームから作品発表・新情報・発売情報を確認する候補。'},
  {id:'bethesda',category:'global',name:'Bethesda',website:'https://bethesda.net/en-US/catalog',description:'The Elder Scrolls、Fallout、DOOMなどの作品情報・対応機種を確認する候補。'},
  {id:'activision',category:'global',name:'Activision',website:'https://www.activision.com/games',description:'公式の作品情報と新作・大型アップデートの発表を確認する候補。'},
  {id:'blizzard',category:'global',name:'Blizzard Entertainment',website:'https://www.blizzard.com/en-us/games/',description:'Diablo、Warcraft、Overwatchなどの作品情報と更新を確認する候補。'},
  {id:'epic',category:'global',name:'Epic Games',website:'https://www.epicgames.com/site/home?lang=en-US',description:'公式作品の発表・更新を確認する候補。ストア全商品の収集とは分けて検討します。'},
  {id:'valve',category:'global',name:'Valve',website:'https://www.valvesoftware.com/en/about/',description:'Valveの自社作品に関する公式情報を確認する候補。既存のSteam作品発見とは別の役割です。'},
  {id:'cd-projekt-red',category:'global',name:'CD PROJEKT RED',website:'https://www.cdprojektred.com/en/our-games',description:'The WitcherやCyberpunkなどの作品紹介・新作情報を確認する候補。'},
  {id:'larian',category:'global',name:'Larian Studios',website:'https://larian.com/',description:'Baldur’s Gate 3やDivinityなど、RPG作品の公式発表を確認する候補。'},
  {id:'supergiant',category:'global',name:'Supergiant Games',website:'https://www.supergiantgames.com/',description:'Hadesなど、見た目とアクションに個性のある作品の公式情報を確認する候補。'},
  {id:'innersloth',category:'global',name:'Innersloth',website:'https://www.innersloth.com/news/',description:'Among Usの開発元。新作や協力・駆け引きのある遊びの公式情報を確認する候補。'},
  {id:'youtube',category:'social',name:'YouTube',website:'https://www.youtube.com/',description:'公式予告・ゲーム映像と反響を確認する候補。公開日時・再生回数等を参照し、独自指標の利用条件と保存期間を確認します。'},
  {id:'x',category:'social',name:'X（旧Twitter）',website:'https://x.com/',description:'メーカー公式発表と公開投稿の反応を確認する候補。APIの取得範囲・利用料・保存条件を確認してから実装します。'},
  {id:'threads',category:'social',name:'Threads',website:'https://www.threads.com/',description:'公式発表や作品についての公開投稿を確認する候補。キーワード検索の権限と、取得できる指標を確認します。'},
  {id:'tiktok',category:'social',name:'TikTok',website:'https://www.tiktok.com/',description:'短いプレイ映像や反応を確認する候補。クリエイター許諾や用途審査などの取得条件があり、全体検索できる前提では扱いません。'},
  {id:'bluesky',category:'social',name:'Bluesky',website:'https://bsky.app/',description:'開発者の発表や作品の感想を確認する候補。公開APIの利用可能な範囲と制限を調べ、少量から検証します。'},
  {id:'reddit',category:'social',name:'Reddit',website:'https://www.reddit.com/',description:'作品別コミュニティの具体的な感想を確認する候補。APIのアクセス承認や商用利用条件を確認します。'},
  {id:'instagram',category:'social',name:'Instagram',website:'https://www.instagram.com/',description:'公式投稿やReelsを確認する候補。プロアカウント向けAPIの範囲を調べ、一般利用者の投稿を網羅できる前提では扱いません。'},
  {id:'itch',category:'discovery',name:'itch.io',website:'https://itch.io/',description:'小規模・実験的な作品を探す候補。取得方法と掲載範囲を調査します。'},
  {id:'day-of-devs',category:'discovery',name:'Day of the Devs',website:'https://www.dayofthedevs.org/showcases',description:'個性的なインディー作品の紹介元。2026/11/01の作品一覧取得は403で停止。自動取得は未対応。'}
];
export function getInformationSources(settings,flags={}) {
  const news=Object.entries(newsSources).map(([id,source])=>({
    id,name:source.name,website:source.website,description:source.description,group:'news',format:source.format,
    status:source.enabled&&settings[source.limitSetting]>0?'enabled':'paused',
    statusLabel:source.enabled&&settings[source.limitSetting]>0?'収集対象':'停止中',
    mode:'まとめて収集（手動開始）',settingKey:source.limitSetting,collectorEnabled:source.enabled,
    action:{label:'記事を確認する',href:'/editor-dashboard.html'}
  }));
  const discoveries=flags.GAME_CATALOG_ENABLED==='true'&&flags.GAME_DISCOVERIES_ENABLED==='true';
  const research=discoveries&&flags.GAME_RESEARCH_ENABLED==='true';
  const manual=[
    {id:'steam',name:'Steam',website:'https://store.steampowered.com/search/?filter=comingsoon',group:'discovery',format:'発売予定作品・スクリーンショット',status:research?'manual':discoveries?'limited':'unavailable',statusLabel:research?'手動で利用可能':discoveries?'画像確認のみ':'準備中',
      description:`作品の説明と画像を確認できます。AI調査は最大${MAX_RESEARCH_ITEMS}作品・概算合計${ESTIMATED_MAX_USD.toFixed(2)}米ドル以下。AI実行時は確認が必要です。`,mode:'画像確認／手動AIリサーチ',action:discoveries?{label:research?'Steamで探す':'発見候補を見る',href:research?'/editor-research.html':'/editor-discoveries.html'}:null},
    {id:SHOWCASE.id,name:SHOWCASE.name,website:SHOWCASE.url,group:'discovery',format:'紹介作品→Steam公式情報',status:discoveries?'manual':'unavailable',statusLabel:discoveries?'手動で利用可能':'準備中',
      description:`紹介元に掲載された発売予定作品を最大${MAX_RESEARCH_ITEMS}作品確認。画像と原文を見て候補へ追加します。AIは使いません。`,mode:'手動取得（AI未使用）',action:discoveries?{label:'紹介作品を探す',href:'/editor-showcase.html'}:null}
  ];
  return [...news,...manual,...plannedSources.map(source=>source.id==='bluesky'&&discoveries&&flags.BLUESKY_PREVIEW_ENABLED==='true'?{...source,group:'discovery',status:'manual',statusLabel:'公式投稿を確認',format:'公式1アカウント・最大5件',mode:'手動取得（AI未使用）',description:'公式サイトが案内するAmong Us Storyの投稿を読み取り、公開日時・反応数と出典を確認します。一般利用者の評判は取得しません。',action:{label:'公式投稿を確認する',href:'/editor-social.html'}}:({...source,categoryLabel:categoryLabels[source.category],group:'planned',status:'planned',statusLabel:'追加候補',mode:'未実装',format:'取得方法・対象範囲を調査',action:null}))];
}
