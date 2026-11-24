import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('retention save uses the same button status and resets on edit',async()=>{
 const make=(extra={})=>({dataset:{},events:{},addEventListener(type,fn){this.events[type]=fn;},...extra});
 const settings={auto_cleanup_enabled:1,auto_cleanup_time_jst:'05:00',pending_retention_days:7,rejected_retention_days:7};
 const inputs=Object.entries(settings).map(([name,value])=>({name,type:typeof value==='string'?'time':'number',value:''}));
 const form=make({querySelectorAll:()=>inputs,reportValidity:()=>true});
 const button=make(),message=make(),fields=make({disabled:true}),window=make({dispatchEvent(){}});
 const nodes={retentionForm:form,retentionFields:fields,retentionMessage:message,saveRetention:button};
 const context=vm.createContext({window,document:{getElementById:id=>nodes[id]},Event,fetch:async(url,options)=>({ok:true,status:200,json:async()=>({settings:options.method==='POST'?JSON.parse(options.body):settings})})});
 vm.runInContext(readFileSync(new URL('../editor-retention-settings.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(fields.disabled,false);
 await form.events.submit({preventDefault(){}});
 assert.equal(button.dataset.saved,'true');assert.equal(button.textContent,'✓ 保存しました');assert.equal(message.dataset.error,'false');
 inputs[2].value='8';form.events.input();assert.equal(button.dataset.saved,'false');assert.equal(button.textContent,'自動整理の設定を保存');assert.equal(message.textContent,'');
});
