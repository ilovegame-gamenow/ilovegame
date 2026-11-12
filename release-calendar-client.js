import './platform-display.js';
import {formatReleaseDate} from './release-calendar-model.js';
export function node(tag,text,className){
 const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;
}
export function releaseCard(release,{showDate=false,demo=false,showTitle=true,showImage=false}={}){
 const card=node('article',undefined,'release-card');
 if(showDate){const time=node('time',formatReleaseDate(release.date),'weekly-date');time.dateTime=release.date;card.append(time);}
 if(release.kind==='early_access')card.append(node('span','早期アクセス開始','early-access'));
 let heading=card;
 if(showImage){
  const header=node('div',undefined,'release-card-header'),info=node('div',undefined,'release-card-info');
  let safeImage=null;try{const url=new URL(release.image);if(url.protocol==='https:'&&!url.username&&!url.password)safeImage=url.href;}catch{}
  if(safeImage){const image=node('img',undefined,'release-thumbnail');image.src=safeImage;image.alt='';image.loading='lazy';image.decoding='async';image.width=160;image.height=90;image.addEventListener('error',()=>{image.hidden=true;header.classList.remove('has-image');},{once:true});header.classList.add('has-image');header.append(image);}
  header.append(info);card.append(header);heading=info;
 }
 if(showTitle)heading.append(node('h3',release.game.title));heading.append(globalThis.GamePlatforms.element(release.platforms));
 if(!demo){
  const related=[...new Map((Array.isArray(release.articles)?release.articles:[]).filter(a=>Number.isSafeInteger(a.id)&&a.id>0).map(a=>[a.id,a])).values()];
  if(related.length){const section=node('section',undefined,'related-articles'),list=node('ul');section.append(node('h4','関連記事'));for(const article of related){const item=node('li'),link=node('a',article.title||'紹介記事を読む');link.href=`/article.html?id=${article.id}`;item.append(link);list.append(item);}section.append(list);card.append(section);}
  const links=node('p',undefined,'source-links');if(!related.length&&Number.isSafeInteger(release.articleId)&&release.articleId>0){const article=node('a','紹介記事を読む');article.href=`/article.html?id=${release.articleId}`;links.append(article);}release.sources.forEach((s,i)=>{const a=node('a',release.sources.length>1?`公式情報 ${i+1} ↗`:'公式サイト・ストアで確認 ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);});card.append(links);}
 return card;
}
export async function requestCalendar(query,signal){
 const response=await fetch(`/api/news?resource=calendar&${query}`,{signal,cache:'no-store'}),result=await response.json();
 if(!response.ok)throw Error(result.error||'発売情報を読み込めませんでした。');
 if(!Array.isArray(result.releases)||!Array.isArray(result.platforms))throw Error('発売情報の形式を確認できませんでした。');
 return result;
}
