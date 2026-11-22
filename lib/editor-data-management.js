import {catalogRequest} from './catalog-database.js';

const LIMIT=20;
const statuses=new Set(['pending','rejected','published']);
const fields='id,title,source_name,status,processing_status,updated_at,thumbnail_url';
const validId=id=>Number.isSafeInteger(id)&&id>0;
const validVersion=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value));
const fail=(status,error,extra={})=>({status,body:{error,...extra}});
const ok=body=>({status:200,body});

export async function listDataArticles(url,key,query,request=catalogRequest){
 const status=query.status??'unpublished',field=query.field??'title',q=query.q??'',page=Number(query.page??1);
 if(!['unpublished','pending','rejected','published'].includes(status)||!['title','source_name','id'].includes(field)||typeof q!=='string'||q.length>100||!Number.isSafeInteger(page)||page<1||page>10000)return fail(400,'検索条件を確認してください。');
 const filter=new URLSearchParams({select:fields,processing_status:'eq.completed',status:status==='unpublished'?'in.(pending,rejected)':'eq.'+status,order:'id.desc',limit:String(LIMIT+1),offset:String((page-1)*LIMIT)});
 const term=q.trim();
 if(term){
  if(field==='id'){if(!/^[1-9]\d*$/.test(term)||!validId(Number(term)))return fail(400,'記事IDは正の整数で入力してください。');filter.set('id','eq.'+term);}
  else filter.set(field,'ilike.*'+term.replace(/[*%_\\]/g,'\\$&')+'*');
 }
 const rows=await request(url,key,'articles?'+filter);
 if(!Array.isArray(rows))throw Error('Invalid article list');
 return ok({articles:rows.slice(0,LIMIT),hasMore:rows.length>LIMIT,page});
}

export async function deleteDataArticles(url,key,body,request=catalogRequest){
 const selected=body?.articles;
 if(!Array.isArray(selected)||selected.length<1||selected.length>LIMIT||typeof body.includePublished!=='boolean'||body.confirmation!=='完全削除 '+selected.length+'件')return fail(400,'削除対象と確認文字を確認してください。');
 if(selected.some(a=>!a||!validId(a.id)||!validVersion(a.updated_at)||!statuses.has(a.status))||new Set(selected.map(a=>a.id)).size!==selected.length)return fail(400,'削除対象が不正です。');
 if(!body.includePublished&&selected.some(a=>a.status==='published'))return fail(400,'掲載中の記事を削除するには明示的な選択が必要です。');
 const ids=selected.map(a=>a.id);
 const lookup=new URLSearchParams({select:'id,status,processing_status,updated_at',id:'in.('+ids.join(',')+')',limit:String(LIMIT)});
 const current=await request(url,key,'articles?'+lookup);
 if(!Array.isArray(current))throw Error('Invalid article lookup');
 const same=(a,b)=>a&&b&&a.id===b.id&&a.status===b.status&&a.updated_at===b.updated_at&&b.processing_status==='completed';
 if(selected.some(a=>!same(a,current.find(b=>b.id===a.id))))return fail(409,'対象記事が変更されたか、処理中になりました。再検索して確認してください。');
 // The final DELETE repeats every version/status condition, not just the preflight IDs.
 // Existing foreign keys cascade article-only dependent records; no game records are deleted.
 const filter=new URLSearchParams({select:'id',processing_status:'eq.completed',or:'('+selected.map(a=>'and(id.eq.'+a.id+',status.eq.'+a.status+',updated_at.eq.'+a.updated_at+')').join(',')+')'});
 const removed=await request(url,key,'articles?'+filter,{method:'DELETE',headers:{Prefer:'return=representation'}});
 if(!Array.isArray(removed)||removed.some(a=>!ids.includes(a.id)))throw Error('Invalid delete result');
 const deletedIds=removed.map(a=>a.id),remainingIds=ids.filter(id=>!deletedIds.includes(id));
 return ok({deletedIds,remainingIds});
}
