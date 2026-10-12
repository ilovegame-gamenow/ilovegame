import { newsConfig } from "./news-config.js";

// AI評価点に応じて記事の掲載方針を決定する
export function determinePublicationPolicy(importance) {
  if (importance <= newsConfig.noArticleThreshold) {
    return "rejected";
  }

  if (importance < newsConfig.publishThreshold) {
    return "review";
  }

  return "published";
}
