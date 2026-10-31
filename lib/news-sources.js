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
 *
 * 将来的には編集室から設定を変更できる
 * 管理機能への拡張を想定する。
 */
export const newsSources = {
  nintendo: {
    name: "Nintendo",
    enabled: true,
    limitSetting: "nintendo_limit",
    collect: collectNintendoArticles
  },

  playstation: {
    name: "PlayStation",
    enabled: true,
    limitSetting: "playstation_limit",
    collect: collectPlayStationArticles
  }
};
