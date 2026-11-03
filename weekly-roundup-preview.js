import {roundupPreview} from './weekly-roundup-preview-data.js';
import {node,releaseCard} from './release-calendar-client.js';
import {formatReleaseDate} from './release-calendar-model.js';
import {officialVideo} from './official-video.js';
const app=document.getElementById('roundupApp');
if(new URLSearchParams(location.search).get('demo')!=='1'){
 app.replaceChildren(node('h1','週まとめ記事は準備中です。'));
 const back=node('a','トップページへ');back.href='/';app.append(back);
}else{
 const notice=node('p','構成確認用の見本です。公式発表を確認した2作品を紹介しています。公開済みの記事・今週の全作品一覧ではありません。','roundup-notice');
 const back=node('a','← トップページの見本に戻る','back');back.href='/?demo=1';app.replaceChildren(back,notice);
 const shell=node('div');shell.innerHTML=GameArticle.render({...roundupPreview.article,thumbnail_url:''});app.append(shell);
 const body=shell.querySelector('.body');body.classList.add('roundup-body');body.replaceChildren();
 const intro=node('p','今週の発売予定から、遊びの仕組みが気になる2作品をご紹介。発売日順に、ゲーム画面と公式トレーラーを見ていきましょう。');body.append(intro);
 const toc=node('nav',undefined,'roundup-toc');toc.setAttribute('aria-label','紹介するゲーム');
 const games=[...roundupPreview.games].sort((a,b)=>a.date.localeCompare(b.date));
 for(const game of games){const link=node('a',`${formatReleaseDate(game.date)}　${game.game.title}`);link.href=`#${game.game.id}`;toc.append(link);}body.append(toc);
 for(const game of games){
  const section=node('section',undefined,'roundup-entry');section.id=game.game.id;
  const date=node('h2',`${formatReleaseDate(game.date)}発売`,'roundup-date');section.append(date);
  const card=releaseCard(game,{demo:false});card.classList.add('roundup-game');
  const image=node('img');image.src=game.image;image.alt=`${game.game.title} 公式ビジュアル`;image.loading='lazy';image.addEventListener('error',()=>{image.hidden=true;},{once:true});
  const figure=node('figure');figure.append(image,node('figcaption',game.credit));card.insertBefore(figure,card.firstChild);
  const detail=node('div',undefined,'roundup-detail');detail.append(node('p',game.description));
  const point=node('aside',undefined,'point');point.append(node('div','ここに注目♪','point-title'),node('p',game.point));detail.append(point);
  const video=officialVideo(game.game.title,game.video);if(video)detail.append(video);
  card.insertBefore(detail,card.querySelector('.source-links'));section.append(card);body.append(section);
 }
 body.append(node('p',`発売予定は2026年11月3日に公式情報で確認した内容です。変更される場合があります。購入前に各公式情報をご確認ください。`,'roundup-footnote'));
 document.title=`${roundupPreview.article.title}（見本） | I LOVE GAME♪`;
}
