import './platform-display.js';
import {formatReleaseDate} from './release-calendar-model.js';
export function node(tag,text,className){
 const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;
}
export function releaseCard(release,{showDate=false,demo=false,showTitle=true}={}){
 const card=node('article',undefined,'release-card');
 if(showDate){const time=node('time',formatReleaseDate(release.date),'weekly-date');time.dateTime=release.date;card.append(time);}
 if(release.kind==='early_access')card.append(node('span','早期アクセス開始','early-access'));
 if(showTitle)card.append(node('h3',release.game.title));card.append(globalThis.GamePlatforms.element(release.platforms));
 if(!demo){const links=node('p',undefined,'source-links');if(Number.isSafeInteger(release.articleId)&&release.articleId>0){const article=node('a','紹介記事を読む');article.href=`/article.html?id=${release.articleId}`;links.append(article);}release.sources.forEach((s,i)=>{const a=node('a',release.sources.length>1?`公式情報 ${i+1} ↗`:'公式サイト・ストアで確認 ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);});card.append(links);}
 return card;
}
export async function requestCalendar(query,signal){
 const response=await fetch(`/api/news?resource=calendar&${query}`,{signal,cache:'no-store'}),result=await response.json();
 if(!response.ok)throw Error(result.error||'発売情報を読み込めませんでした。');
 if(!Array.isArray(result.releases)||!Array.isArray(result.platforms))throw Error('発売情報の形式を確認できませんでした。');
 return result;
}
