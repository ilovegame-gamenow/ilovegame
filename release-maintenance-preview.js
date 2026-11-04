import {renderReleaseMaintenance} from './release-maintenance-view.js';
const schedule=(date,status='announced')=>({status,release_date:date,date_precision:date?'day':'unknown',release_label:''});
const example=(id,title,platform,before,after,reason)=>({id,release:{game:{title},platform_code:platform,region_code:'JP'},before_values:schedule(before),proposed:after,reason,evidence:'この確認内容は操作の見本です。実際の告知ではありません。',source:{url:'https://example.com/',review_status:'verified'}});
const data={pending:[
 example('new-date','サンプル：星めぐりの冒険','PS5','2026-11-12',schedule('2026-12-03'),'PS5版だけ発売延期。Switch 2版の日程は変わりません。'),
 example('unknown','サンプル：小さな島の暮らし','Nintendo Switch 2','2026-11-20',schedule(null,'delayed'),'発売延期が発表され、新しい日程は未定です。')
],due:[{title:'サンプル：空のアトリエ',platform_code:'PS5',...schedule('2026-11-08')}],recentChecks:[{release:{game:{title:'サンプル：月夜の探検隊'},platform_code:'Windows'},outcome:'ambiguous',reason:'ストアと公式告知の対象地域を確認中です。日付は変更していません。'}],history:[],hasMorePending:false};
const message=document.getElementById('previewMessage'),list=document.getElementById('releasePreview');
function render(){renderReleaseMaintenance(list,data,async(action,c)=>{
 data.pending=data.pending.filter(x=>x.id!==c.id);
 if(action==='apply')data.history.unshift({release:c.release,before_values:c.before_values,after_values:c.proposed});
 message.textContent=action==='apply'?'見本の変更を反映しました。下の変更履歴で元の日付を確認できます。':'見本の候補を採用せずに閉じました。発売日は変わりません。';render();
});}
render();
