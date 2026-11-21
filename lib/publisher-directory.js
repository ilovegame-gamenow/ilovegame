import {catalogRequest} from './catalog-database.js';
import {randomUUID} from 'node:crypto';
export const defaultGroups=[{"id":"sega","label":"株式会社セガ","aliases":["SEGA","セガ","株式会社セガ","株式会社セガ（PR TIMES）"]},{"id":"nintendo","label":"任天堂株式会社","aliases":["Nintendo","任天堂","任天堂株式会社"]},{"id":"capcom","label":"株式会社カプコン","aliases":["CAPCOM","カプコン","株式会社カプコン"]},{"id":"playstation","label":"PlayStation","aliases":["PlayStation","PlayStation.Blog 日本語","PlayStation.Blog"]},{"id":"snk","label":"株式会社SNK","aliases":["SNK","株式会社SNK"]},{"id":"room6","label":"株式会社room6","aliases":["room6","株式会社room6"]},{"id":"phoenixx","label":"株式会社Phoenixx","aliases":["Phoenixx","株式会社Phoenixx"]},{"id":"satbox","label":"SAT-BOX株式会社","aliases":["SAT-BOX","SAT-BOX株式会社"]},{"id":"shochiku","label":"松竹株式会社","aliases":["松竹","松竹株式会社"]},{"id":"gmode","label":"株式会社ジー・モード","aliases":["ジー・モード","株式会社ジー・モード"]},{"id":"taito","label":"株式会社タイトー","aliases":["タイトー","株式会社タイトー"]},{"id":"voltage","label":"株式会社ボルテージ","aliases":["ボルテージ","株式会社ボルテージ"]},{"id":"hoyoverse","label":"HoYoverse","aliases":["HoYoverse","HoYoverse（PlayStation.Blog）"]},{"id":"bandainamco","label":"株式会社バンダイナムコエンターテインメント","aliases":["バンダイナムコエンターテインメント","株式会社バンダイナムコエンターテインメント"]}];
const clean=s=>String(s??'').trim();
const norm=s=>clean(s).normalize('NFKC').toLocaleLowerCase('ja');
const validText=s=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=200&&!/[\u0000-\u001f\u007f]/.test(s);
export function validateGroups(groups){
 if(!Array.isArray(groups)||groups.length>500)return false;
 const ids=new Set(),names=new Set(),aliases=new Set();
 for(const g of groups){
  if(!g||typeof g.id!=='string'||!(/^[a-z0-9-]{1,80}$/).test(g.id)||ids.has(g.id)||!validText(g.label)||names.has(norm(g.label))||!Array.isArray(g.aliases)||!g.aliases.length||g.aliases.length>100)return false;
  ids.add(g.id);names.add(norm(g.label));
  for(const a of g.aliases){if(!validText(a)||aliases.has(norm(a)))return false;aliases.add(norm(a));}
 }
 return true;
}
export function publisherGroup(name,groups){const key=norm(name);return key?groups.find(g=>g.aliases.some(a=>norm(a)===key))||null:null;}
export function publisherLabel(name,groups){return publisherGroup(name,groups)?.label||clean(name).replace(/\s*[（(]\s*(?:PR\s*TIMES|PlayStation\.Blog)\s*[）)]\s*$/i,'').trim()||clean(name)||'情報元未設定';}
export function publisherId(name,groups){const g=publisherGroup(name,groups);return g?'group:'+g.id:clean(name)?'name:'+name:'other';}
export async function readPublisherDirectory(url,key){
 const rows=await catalogRequest(url,key,'publisher_directory?id=eq.1&select=version,groups');
 const row=rows?.[0];if(!row||!Number.isSafeInteger(row.version)||!validateGroups(row.groups))throw Error('情報元設定が取得できません');
 return row;
}
export async function publicPublisherLabel(url,key,name){
 try{return publisherLabel(name,(await readPublisherDirectory(url,key)).groups);}catch{return publisherLabel(name,defaultGroups);}
}
export function editDirectory(directory,body){
 if(!body||body.version!==directory.version)return {status:409,error:'別の編集が保存されています。再読み込みしてください。'};
 const {source,label,aliases}=body;
 if(typeof source!=='string'||!validText(label)||!Array.isArray(aliases)||!aliases.length||aliases.length>100||aliases.some(a=>!validText(a)))return {status:400,error:'表示名と別名を確認してください。'};
 const groups=directory.groups.map(g=>({...g,aliases:[...g.aliases]}));
 let g;
 if(source.startsWith('group:')){g=groups.find(x=>x.id===source.slice(6));if(!g)return {status:409,error:'情報元が変更されています。'};}
 else if(source.startsWith('name:')&&validText(source.slice(5))&&!publisherGroup(source.slice(5),groups)){g={id:randomUUID(),label:'',aliases:[]};groups.push(g);}
 else return {status:400,error:'編集対象が不正です。'};
 g.label=clean(label);g.aliases=[...new Map(aliases.map(a=>[norm(a),clean(a)])).values()];
 if(source.startsWith('name:')&&!g.aliases.some(a=>norm(a)===norm(source.slice(5))))return {status:400,error:'選択中の元表記を別名に含めてください。'};
 if(!validateGroups(groups))return {status:400,error:'表示名または別名が他の情報元と重複しています。先に別名を整理してください。'};
 return {groups,id:'group:'+g.id};
}
export async function savePublisherDirectory(url,key,body){
 const current=await readPublisherDirectory(url,key);const result=editDirectory(current,body);if(result.error)return result;
 const rows=await catalogRequest(url,key,'publisher_directory?id=eq.1&version=eq.'+current.version+'&select=version,groups',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({groups:result.groups,version:current.version+1,updated_at:new Date().toISOString()})});
 if(!rows?.length)return {status:409,error:'別の編集が保存されています。再読み込みしてください。'};
 return {status:200,source:result.id,version:rows[0].version};
}
