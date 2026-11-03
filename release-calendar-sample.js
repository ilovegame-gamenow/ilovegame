// Explicit preview data only. Never used as a fallback for a live request.
import {tokyoMonth,weekRange,calendarGroups} from './release-calendar-model.js';
export function sampleCalendar({month=tokyoMonth(),view='month',platform='',region='JP'}={}){
 const games=[['星めぐりの冒険','03',['switch-2','ps5']],['虹色パーティー','12',['windows','switch-2']],['空のアトリエ','12',['ps5']],['小さな島の暮らし','21',['switch-2']],['月夜の探検隊','28',['windows']],['まだ見ぬ旅へ','01',['ps5']]];
 const week=weekRange(),platforms=[{code:'switch-2',name:'Nintendo Switch 2'},{code:'ps5',name:'PlayStation 5'},{code:'windows',name:'Windows'}];
 if(view==='week')return {region,platforms,truncated:false,...week,releases:[...new Set([week.start.slice(0,7),week.last.slice(0,7)])].flatMap(m=>sampleCalendar({month:m,platform,region}).releases).filter(r=>r.precision==='day'&&r.date>=week.start&&r.date<week.end)};
 const rows=games.flatMap(([title,day,codes],i)=>codes.map(code=>({game:{id:String(i),title:`サンプル：${title}`},date:`${month}-${day}`,precision:i===5?'month':'day',kind:i===4?'early_access':'full',region,platform:platforms.find(p=>p.code===code),source:{url:'https://example.com/'}}))).filter(r=>!platform||r.platform.code===platform);
 return {month,region,platforms,releases:calendarGroups(rows),truncated:false};
}
