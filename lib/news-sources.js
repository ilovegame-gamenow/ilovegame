import { collectNintendoArticles } from "./collectors/nintendo.js";
import { collectPlayStationArticles } from "./collectors/playstation.js";

/**
 * ゲームニュースの収集元を一元管理する。
 *
 * enabled:
 *   true  = 収集対象
 *   false = 収集停止
 *
 * limitSetting:
 *   編集室で設定する収集件数のキー
 *
 * 新しいメーカーを追加するときは、
 * 収集モジュールを作成してここに登録する。
 */
export const newsSources = {
  nintendo: {
    name: "Nintendo",
    website: "https://www.nintendo.com/jp/topics/",
    description: "Nintendo Topicsの公式ニュース。新作・更新・イベントなどを確認します。",
    format: "公式ニュース記事",
    enabled: true,
    limitSetting: "nintendo_limit",
    collect: collectNintendoArticles
  },

  playstation: {
    name: "PlayStation",
    website: "https://blog.ja.playstation.com/",
    description: "PlayStation Blog日本語版。作品紹介や発売・更新の公式情報を確認します。",
    format: "公式ニュース記事",
    enabled: true,
    limitSetting: "playstation_limit",
    collect: collectPlayStationArticles
  }
};
