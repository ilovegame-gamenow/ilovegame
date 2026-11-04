// Editorial recognition tiers for headline selection, not article publication scores.
// Match established series names at the beginning; mentions in unrelated titles do not qualify.
const establishedSeries = [
 /^(?:ゼルダの伝説(?:[\s：:]|$)|The Legend of Zelda(?:[\s：:]|$))/i,
 /^(?:(?:スーパー)?マリオ|Super Mario|Mario(?:[\s：:]|$))/i,
 /^(?:ポケットモンスター|ポケモン|Pok[eé]mon(?:[\s：:]|$))/i,
 /^(?:マインクラフト|Minecraft(?:[\s：:]|$))/i,
 /^(?:グランド・セフト・オート|Grand Theft Auto(?:[\s：:]|$))/i,
 /^(?:ドラゴンクエスト|Dragon Quest(?:[\s：:]|$))/i,
 /^(?:ファイナルファンタジー|Final Fantasy(?:[\s：:]|$))/i,
 /^(?:モンスターハンター|Monster Hunter(?:[\s：:]|$))/i
];

export function recognitionTier(title) {
 return establishedSeries.some(pattern=>pattern.test(String(title)))?1:0;
}

export function compareFeaturedGames(a,b) {
 // Recognition takes precedence; news importance is only a secondary signal.
 const attention = r => Number.isInteger(r.editorial?.importance)?r.editorial.importance:0;
 return recognitionTier(b.game.title)-recognitionTier(a.game.title)
  || attention(b)-attention(a)
  || a.date.localeCompare(b.date)
  || a.game.title.localeCompare(b.game.title,'ja');
}
