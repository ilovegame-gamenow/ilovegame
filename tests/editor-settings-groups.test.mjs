import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {settingRules} from '../lib/site-settings.js';

test('saving one panel preserves unsaved input and dirty state in other panels', async()=>{
 const keys={basic:['editor_session_minutes','public_page_size','editor_page_size'],publication:['publish_threshold','no_article_threshold','breaking_max_age_hours','pickup_max_articles','pickup_max_age_hours'],evaluation:['evaluation_guidelines']};
 const settings=Object.fromEntries(Object.entries(settingRules).map(([key,rule])=>[key,rule.defaultValue]));
 const make=(extra={})=>({dataset:{},events:{},addEventListener(type,fn){this.events[type]=fn;},...extra});
 const panels=Object.entries(keys).map(([group,names])=>{
  const fields=names.map(name=>make({name,type:name==='evaluation_guidelines'?'textarea':'number',value:'',reportValidity:()=>true,setCustomValidity(){}}));
  const button=make({textContent:group}),result=make({hidden:true});
  return make({dataset:{settingsGroup:group},fields,button,result,querySelectorAll:()=>fields,querySelector:selector=>selector==='[data-save-group]'?button:result});
 });
 const fields=panels.flatMap(p=>p.fields),elements=Object.fromEntries(fields.map(f=>[f.name,f]));
 const form=make({elements,querySelectorAll:selector=>selector==='[data-settings-group]'?panels:fields});
 const nodes={settingsForm:form,settingsFields:make({disabled:true}),settingsMessage:make(),publicationSummary:make(),resetGuidelines:make()};
 const requests=[],window=make(),session={start(){},refresh(){}};
 const context=vm.createContext({window,document:{getElementById:id=>nodes[id],addEventListener(){}},GameEditorSession:session,Event,fetch:async(url,options)=>{
  if(options.method==='POST'){const body=JSON.parse(options.body);requests.push({url,body});Object.assign(settings,body);}
  return {status:200,ok:true,json:async()=>({settings:{...settings},rules:settingRules})};
 }});
 vm.runInContext(readFileSync(new URL('../editor-settings.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.settingsFields.disabled,false);
 elements.public_page_size.value='32';elements.evaluation_guidelines.value='未保存の方針';panels[0].events.input();panels[2].events.input();
 await panels[0].button.events.click();
 assert.equal(requests[0].url,'/api/editor-settings?resource=basic');assert.equal(requests[0].body.public_page_size,32);
 assert.equal(requests[0].body.evaluation_guidelines,undefined);assert.equal(elements.evaluation_guidelines.value,'未保存の方針');
 let blocked=false;window.events.beforeunload({preventDefault(){blocked=true;}});assert.equal(blocked,true);
 await panels[2].button.events.click();assert.equal(requests[1].body.evaluation_guidelines,'未保存の方針');
 blocked=false;window.events.beforeunload({preventDefault(){blocked=true;}});assert.equal(blocked,false);
});
