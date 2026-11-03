import {youtubeVideoId} from './game-source-utils.js';
import {node} from './release-calendar-client.js';
export function officialVideo(title,url){
 const id=youtubeVideoId(url);if(!id)return null;
 const section=node('div',undefined,'official-video'),player=node('div',undefined,'official-video-player');
 const frame=node('iframe');frame.title=`${title} 公式動画`;
 frame.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0`;
 frame.loading='lazy';frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 player.append(frame);section.append(player);
 const link=node('a','YouTubeで公式動画を見る ↗');link.href=`https://www.youtube.com/watch?v=${id}`;link.target='_blank';link.rel='noopener noreferrer';section.append(link);
 return section;
}
