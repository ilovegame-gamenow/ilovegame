/* One display policy for article cards, calendar, weekly summaries and the editor. */
globalThis.GamePlatforms = (() => {
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const definitions=[
  ['Switch 2','switch',['nintendoswitch2','switch2']],['Switch','switch',['nintendoswitch','switch']],
  ['Wii U','switch',['wiiu']],['PS5','playstation',['playstation5','ps5']],['PS4','playstation',['playstation4','ps4']],
  ['Xbox Series X|S','xbox',['xboxseriesx|s','xboxseriesx/s','xboxseriesxs','xboxseries','xboxx|s']],
  ['Xbox Series X','xbox',['xboxseriesx','xboxx']],['Xbox Series S','xbox',['xboxseriess','xboxs']],['Xbox One','xbox',['xboxone']],['Xbox','xbox',['xbox']],
  ['PC','pc',['pc','windows','microsoftwindows']],['Steam','pc',['steam','pc(steam)']],['Epic','pc',['epic','epicgames','epicgamesstore']],
  ['Mac','pc',['mac','macos']],['Linux','pc',['linux']],['iOS','mobile',['ios','iphone','ipad','ios(appstore)','iphone/ipad(appstore)']],
  ['Android','mobile',['android']],['スマホ','mobile',['mobile','スマホ','スマートフォン']],['ブラウザ','other',['browser','web','ブラウザ']]
 ];
 const key=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s_-]+/g,'');
 const aliases=new Map();definitions.forEach(([label,color,names],order)=>names.forEach(name=>aliases.set(key(name),{label,color,order})));
 function describe(value){
  const raw=typeof value==='object'&&value?value.name||value.code||'':value;
  const original=String(raw??'').trim();return aliases.get(key(original))||{label:original,color:'other',order:definitions.length};
 }
 function list(values){
  if(!Array.isArray(values))return [];
  const found=new Map();values.forEach(value=>{const item=describe(value);if(item.label)found.set(item.label,item);});
  if(found.has('Steam')||found.has('Epic'))found.delete('PC');
  return [...found.values()].sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,'ja'));
 }
 function render(values){const items=list(values);return items.length?`<div class="platform-badges">${items.map(p=>`<span class="platform-badge platform-badge--${p.color}">${escape(p.label)}</span>`).join('')}</div>`:'';}
 function element(values,document=globalThis.document){
  const group=document.createElement('div');group.className='platform-badges';
  for(const p of list(values)){const badge=document.createElement('span');badge.className=`platform-badge platform-badge--${p.color}`;badge.textContent=p.label;group.append(badge);}
  return group;
 }
 return {describe,list,render,element};
})();
