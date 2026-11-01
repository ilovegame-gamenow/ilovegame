import test from 'node:test';import assert from 'node:assert/strict';
import { getInformationSources } from '../lib/information-sources.js';
import { newsSources } from '../lib/news-sources.js';
import { settingRules } from '../lib/site-settings.js';
const settings=Object.fromEntries(Object.entries(settingRules).map(([key,rule])=>[key,rule.defaultValue]));
const flags={GAME_CATALOG_ENABLED:'true',GAME_DISCOVERIES_ENABLED:'true',GAME_RESEARCH_ENABLED:'true',OPENAI_API_KEY:'must-never-leak'};
test('source status derives from actual collector flags and saved limits',()=>{
 const active=getInformationSources(settings,flags);assert.equal(active.find(s=>s.id==='nintendo').status,'enabled');
 const paused=getInformationSources({...settings,nintendo_limit:0},flags);assert.equal(paused.find(s=>s.id==='nintendo').status,'paused');
 const previous=newsSources.playstation.enabled;newsSources.playstation.enabled=false;
 try{assert.equal(getInformationSources(settings,flags).find(s=>s.id==='playstation').status,'paused');}finally{newsSources.playstation.enabled=previous;}
 assert.equal(active.find(s=>s.id==='nintendo').settingKey,newsSources.nintendo.limitSetting);
 assert.ok(!JSON.stringify(active).includes('must-never-leak'));
});
test('manual discovery availability follows all existing feature gates',()=>{
 assert.equal(getInformationSources(settings,flags).find(s=>s.id==='steam').status,'manual');
 assert.equal(getInformationSources(settings,{...flags,GAME_RESEARCH_ENABLED:'false'}).find(s=>s.id==='steam').status,'limited');
 for(const key of ['GAME_CATALOG_ENABLED','GAME_DISCOVERIES_ENABLED']){
  const sources=getInformationSources(settings,{...flags,[key]:'false'}).filter(s=>s.group==='discovery');
  assert.ok(sources.every(s=>s.status==='unavailable'&&s.action===null));
 }
});
test('planned sources have no setting controls, enabled collectors or action links',()=>{
 const sources=getInformationSources(settings,flags),planned=sources.filter(s=>s.group==='planned');
 assert.ok(planned.some(s=>s.id==='xbox'));assert.ok(planned.length>=4);
 assert.ok(planned.every(s=>s.status==='planned'&&!s.settingKey&&!s.action));
 assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
 assert.ok(sources.every(s=>new URL(s.website).protocol==='https:'));
 const controls=sources.filter(s=>s.settingKey).map(s=>s.settingKey);
 assert.equal(new Set(controls).size,controls.length);
 assert.deepEqual(controls.sort(),Object.values(newsSources).map(s=>s.limitSetting).sort());
});
