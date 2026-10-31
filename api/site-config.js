import { getSiteSettings } from "../lib/site-settings.js";

// Expose only public display configuration, never the private editorial guidelines.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const settings = await getSiteSettings(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
    return res.status(200).json({
      pickupThreshold: settings.pickup_threshold,
      maxPickupArticles: settings.pickup_max_articles,
      dateHighlightHours: settings.date_highlight_hours
    });
  } catch {
    return res.status(503).json({ error:'Display settings unavailable' });
  }
}
