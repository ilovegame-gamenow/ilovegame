import { newsSources } from './news-sources.js';
import { SHOWCASE } from './game-source-previews.js';
import { MAX_RESEARCH_ITEMS } from './steam-discovery-source.js';
import { ESTIMATED_MAX_USD } from './game-research-ai.js';
// These are editorial expansion candidates, not enabled collectors or editable runtime settings.
const plannedSources=[
  {id:'xbox',name:'Microsoft / Xbox',website:'https://news.xbox.com/ja-jp/',description:'Xbox Wire Japanの公式ニュース。次の主要プラットフォーム候補。'},
  {id:'capcom',name:'カプコン',website:'https://www.capcom.co.jp/',description:'主要作品・新作・更新の公式情報を収集する候補。'},
  {id:'square-enix',name:'スクウェア・エニックス',website:'https://www.jp.square-enix.com/game/',description:'公式の作品情報と機種別発売情報を収集する候補。'},
  {id:'bandai-namco',name:'バンダイナムコエンターテインメント',website:'https://www.bandainamcoent.co.jp/cs/catalog/',description:'公式ゲームカタログと新作情報を収集する候補。'},
  {id:'itch',name:'itch.io',website:'https://itch.io/',description:'小規模・実験的な作品を探す候補。取得方法と掲載範囲を調査します。'},
  {id:'day-of-devs',name:'Day of the Devs',website:'https://www.dayofthedevs.org/showcases',description:'個性的なインディー作品の紹介元。2026/11/01の作品一覧取得は403で停止。自動取得は未対応。'}
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
  return [...news,...manual,...plannedSources.map(source=>({...source,group:'planned',status:'planned',statusLabel:'追加候補',mode:'未実装',format:'取得方法・対象範囲を調査',action:null}))];
}
