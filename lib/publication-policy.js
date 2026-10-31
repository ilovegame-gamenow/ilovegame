import { newsConfig } from "./news-config.js";

// AI評価点に応じて記事の掲載方針を決定する
export function determinePublicationPolicy(importance, config = newsConfig) {
  if (importance <= config.noArticleThreshold) {
    return "rejected";
  }

  if (importance < config.publishThreshold) {
    return "review";
  }

  return "published";
}
