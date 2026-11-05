import {node,releaseCard} from './release-calendar-client.js';
import {formatReleaseDate} from './release-calendar-model.js';
import {officialVideo} from './official-video.js';

export function renderWeeklyRoundup(result, entries, toc) {
  entries.replaceChildren(); toc.replaceChildren();
  const releases = [...result.releases].sort((a,b) => a.date.localeCompare(b.date) || a.game.title.localeCompare(b.game.title,'ja'));
  toc.hidden = !releases.length;
  for (const [index, release] of releases.entries()) {
    const id = `release-${index}`, label = `${formatReleaseDate(release.date)}　${release.game.title}${release.kind === 'early_access' ? '（早期アクセス開始）' : ''}`;
    const link = node('a',label); link.href = `#${id}`; toc.append(link);
    const section = node('section',undefined,'roundup-entry'); section.id = id;
    section.ariaLabel = release.game.title;
    const heading = node('h2',release.game.title,'roundup-title'); heading.id = `${id}-title`;
    section.append(heading,node('p',`${formatReleaseDate(release.date)}${release.kind === 'early_access' ? ' 早期アクセス開始' : '発売'}`,'roundup-date'));
    const card = releaseCard(release,{showTitle:false}); card.classList.add('roundup-game');
    if (release.image) {
      const image = node('img'); image.src = release.image; image.alt = `${release.game.title} 紹介画像`; image.loading = 'lazy';
      const figure = node('figure'); figure.append(image);
      image.addEventListener('error', () => { figure.hidden = true; }, {once:true});
      card.insertBefore(figure,card.firstChild);
    }
    const detail = node('div',undefined,'roundup-detail'), editorial = release.editorial;
    if (editorial) {
      if (editorial.summary) detail.append(node('p',editorial.summary));
      if (editorial.point) {
        const point = node('aside',undefined,'point'); point.append(node('div','ここに注目♪','point-title'),node('p',editorial.point)); detail.append(point);
      }
      for (const url of editorial.videos ?? []) {
        const video = officialVideo(release.game.title,url); if (video) detail.append(video);
      }
      const article = node('a','ゲームの詳しい紹介記事を読む →'); article.href = `/article.html?id=${editorial.articleId}`; detail.append(article);
    } else {
      detail.append(node('p','発売日と対応機種を掲載しています。遊びの詳しい内容は、公式サイト・ストアをご覧ください。'));
    }
    const sources = card.querySelector('.source-links');
    sources.classList.add('source');
    sources.replaceChildren(node('span','情報元：'));
    release.sources.forEach((source,index) => {
      if(index)sources.append(node('span',' ／ '));
      let name = source.name;
      if(!name){
        try{const host = new URL(source.url).hostname.replace(/^www\./,'');name = host === 'store.steampowered.com' ? 'Steam' : host;}catch{name = '公式サイト';}
      }
      const link = node('a',name); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; sources.append(link);
    });
    card.insertBefore(detail,card.querySelector('.source-links')); section.append(card); entries.append(section);
  }
  if (!releases.length) entries.append(node('p','今週の発売情報はまだ登録されていません。確認できた作品から順次追加します。','empty-calendar'));
}
