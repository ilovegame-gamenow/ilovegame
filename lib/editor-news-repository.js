// Editorial source filters follow saved article provenance, independently of collectors.
import {readPublisherDirectory,publisherId,publisherLabel} from './publisher-directory.js';
const statuses = ['all', 'pending', 'published', 'rejected'];
const legacyNames = { nintendo:'Nintendo', playstation:'PlayStation' };
const sourceName = id => (Object.hasOwn(legacyNames,id)?legacyNames[id]:null) ?? (id.startsWith('name:') ? id.slice(5) : null);
const validSource = value => typeof value==='string' && (['all','other',...Object.keys(legacyNames)].includes(value) || (value.startsWith('name:') && value.length>5 && value.length<=1005 && !/[\u0000-\u001f]/.test(value)) || /^group:[a-z0-9-]{1,80}$/.test(value));
export function parseEditorNewsQuery(query) {
 const status=query.status??'all',source=query.source??'all',rawPage=query.page??'1',page=Number(rawPage);
 if(!statuses.includes(status)||!validSource(source)||!['string','number'].includes(typeof rawPage)||!Number.isSafeInteger(page)||page<1||page>1000)return null;
 return {status,source,page};
}
function filters(params,status,source,aliases){
 if(status!=='all')params.set('status',`eq.${status}`);
 if(source==='other')params.set('or','(source_name.is.null,source_name.eq.)');
 else if(source!=='all'){if(aliases.length)params.set('source_name','in.('+aliases.map(a=>JSON.stringify(a)).join(',')+')');else params.set('id','eq.0');}
 return params;
}
function totalFrom(response){
 if(!response.ok&&response.status!==416)throw Error(`Article count request failed (${response.status})`);
 const range=response.headers.get('content-range'),total=range?Number(range.split('/')[1]):NaN;
 if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid article count');return total;
}
async function sourceMetadata(request){
 const rows=[];
 for(let offset=0;offset<100000;offset+=1000){
  const response=await request(new URLSearchParams({select:'id,source_name,status',order:'id.asc',limit:'1000',offset:String(offset)}));
  if(!response.ok)throw Error('Source counts unavailable');const page=await response.json();
  if(!Array.isArray(page))throw Error('Invalid source metadata');rows.push(...page);
  if(page.length<1000)return rows;
 }
 throw Error('Source counts exceed supported range');
}
export async function getEditorNews({supabaseUrl,supabaseKey,status,source,page,limit}){
 const headers={apikey:supabaseKey,Authorization:`Bearer ${supabaseKey}`,Prefer:'count=exact'};
 const request=params=>fetch(`${supabaseUrl}/rest/v1/articles?${params}`,{headers});
 const [metadata,directory]=await Promise.all([sourceMetadata(request),readPublisherDirectory(supabaseUrl,supabaseKey)]);
 const groups=directory.groups;
 // Map old bookmarks to the current group without changing the stored source.
 if(source==='nintendo'||source==='playstation'||source.startsWith('name:'))source=publisherId(sourceName(source),groups);
 if(source.startsWith('group:')&&!groups.some(g=>'group:'+g.id===source))source='all';
 const aliases=[...new Set(metadata.filter(row=>publisherId(row.source_name,groups)===source).map(row=>row.source_name).filter(Boolean))];
 const params=filters(new URLSearchParams({select:'id,title,summary,thumbnail_url,source_name,platforms,created_at,published_at,status,importance,processing_status,manually_reviewed,site_published_at,source_url',order:'id.desc',limit:String(limit),offset:String((page-1)*limit)}),status,source,aliases);
 const response=await request(params);
 const total=totalFrom(response),correctedPage=Math.min(page,Math.max(1,Math.ceil(total/limit)));
 let articleResponse=response;
 if(correctedPage!==page){params.set('offset',String((correctedPage-1)*limit));articleResponse=await request(params);}
 if(!articleResponse.ok)throw Error('Article request failed');
 const counts=Object.fromEntries(statuses.map(s=>[s,0])),options=new Map();
 for(const group of groups)options.set('group:'+group.id,{id:'group:'+group.id,label:group.label,count:0,aliases:group.aliases,observed:[]});
 for(const row of metadata){
  const id=publisherId(row.source_name,groups);
  if(!options.has(id))options.set(id,{id,label:publisherLabel(row.source_name,groups),count:0,aliases:row.source_name?[row.source_name]:[],observed:[]});
  const option=options.get(id);
  if(!option.observed.some(a=>a.name===row.source_name))option.observed.push({name:row.source_name,count:0});
  option.observed.find(a=>a.name===row.source_name).count++;
  if(status==='all'||row.status===status)option.count++;
  if(source==='all'||id===source){counts.all++;if(Object.hasOwn(counts,row.status)&&row.status!=='all')counts[row.status]++;}
 }
 if(source!=='all'&&!options.has(source))options.set(source,{id:source,label:sourceName(source)||'情報元未設定',count:0,aliases:sourceName(source)?[sourceName(source)]:[],observed:[]});
 const sources=[{id:'all',label:'すべて',count:metadata.filter(r=>status==='all'||r.status===status).length},...Array.from(options.values()).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ja'))];
 const articles=(await articleResponse.json()).map(a=>({...a,source_display_name:publisherLabel(a.source_name,groups)}));
 return {articles,page:correctedPage,limit,total,counts,sources,directoryVersion:directory.version,filters:{status,source}};
}
