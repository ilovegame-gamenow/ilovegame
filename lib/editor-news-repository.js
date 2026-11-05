// Editorial source filters follow saved article provenance, independently of collectors.
const statuses = ['all', 'pending', 'published', 'rejected'];
const legacyNames = { nintendo:'Nintendo', playstation:'PlayStation' };
const sourceId = name => !name ? 'other' : Object.entries(legacyNames).find(([,label])=>label===name)?.[0] || `name:${name}`;
const sourceName = id => legacyNames[id] ?? (id.startsWith('name:') ? id.slice(5) : null);
const validSource = value => typeof value==='string' && (['all','other',...Object.keys(legacyNames)].includes(value) || (value.startsWith('name:') && value.length>5 && value.length<=1005 && !/[\u0000-\u001f]/.test(value)));
export function parseEditorNewsQuery(query) {
 const status=query.status??'all',source=query.source??'all',rawPage=query.page??'1',page=Number(rawPage);
 if(!statuses.includes(status)||!validSource(source)||!['string','number'].includes(typeof rawPage)||!Number.isSafeInteger(page)||page<1||page>1000)return null;
 return {status,source,page};
}
function filters(params,status,source){
 if(status!=='all')params.set('status',`eq.${status}`);
 if(source==='other')params.set('or','(source_name.is.null,source_name.eq.)');
 else if(source!=='all')params.set('source_name',`eq.${sourceName(source)}`);
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
 const params=filters(new URLSearchParams({select:'id,title,summary,thumbnail_url,source_name,platforms,created_at,published_at,status,importance,processing_status,manually_reviewed,site_published_at,source_url',order:'id.desc',limit:String(limit),offset:String((page-1)*limit)}),status,source);
 const [response,metadata]=await Promise.all([request(params),sourceMetadata(request)]);
 const total=totalFrom(response),correctedPage=Math.min(page,Math.max(1,Math.ceil(total/limit)));
 let articleResponse=response;
 if(correctedPage!==page){params.set('offset',String((correctedPage-1)*limit));articleResponse=await request(params);}
 if(!articleResponse.ok)throw Error('Article request failed');
 const counts=Object.fromEntries(statuses.map(s=>[s,0])),options=new Map();
 for(const row of metadata){
  const id=sourceId(row.source_name);
  if(!options.has(id))options.set(id,{id,label:row.source_name||'情報元未設定',count:0});
  if(status==='all'||row.status===status)options.get(id).count++;
  if(source==='all'||id===source){counts.all++;if(Object.hasOwn(counts,row.status)&&row.status!=='all')counts[row.status]++;}
 }
 if(source!=='all'&&!options.has(source))options.set(source,{id:source,label:sourceName(source)||'情報元未設定',count:0});
 const sources=[{id:'all',label:'すべて',count:metadata.filter(r=>status==='all'||r.status===status).length},...Array.from(options.values()).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ja'))];
 return {articles:await articleResponse.json(),page:correctedPage,limit,total,counts,sources,filters:{status,source}};
}
