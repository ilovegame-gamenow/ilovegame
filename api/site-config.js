import { newsConfig } from "./news-config.js";

// サイト表示に必要な設定だけを公開する
export default function handler(req, res) {
  res.status(200).json({
    pickupThreshold: newsConfig.pickupThreshold,
    maxPickupArticles: newsConfig.maxPickupArticles
  });
}
