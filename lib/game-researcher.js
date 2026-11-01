import { collectSteamDiscoveries } from './steam-discovery-source.js';
import { analyzeResearchSources,buildResearchRequest } from './game-research-ai.js';
import { getResearchRun,knownSteamIds,prepareResearchRun,claimResearchRun,completeResearchRun,failResearchRun } from './game-research-repository.js';
export async function prepareSteamResearch(url,key,id) {
  const existing=await getResearchRun(url,key,id);if(existing)return existing;
  const sources=await collectSteamDiscoveries(ids=>knownSteamIds(url,key,ids));
  buildResearchRequest(sources); // Verify the input budget before preparing any paid action.
  return prepareResearchRun(url,key,id,sources);
}
export async function executeSteamResearch(url,key,id,openaiKey) {
  if(!openaiKey)throw Error('AI unavailable');
  const existing=await getResearchRun(url,key,id);
  if(existing?.status==='completed'||existing?.status==='failed')return existing;
  // Claim first. A rejected duplicate must never call AI or mark another worker's run failed.
  const run=await claimResearchRun(url,key,id);
  let phase='analyze';
  try {
    const result=await analyzeResearchSources(run.sources,openaiKey);
    phase='save';
    return await completeResearchRun(url,key,id,result);
  }catch(error){
    console.error('game_research_failed',JSON.stringify({run_id:id,phase,...(error.researchDiagnostic||{code:phase==='save'?'database_save':'transport_or_unclassified'})}));
    await failResearchRun(url,key,id).catch(()=>{});
    throw error;
  }
}
