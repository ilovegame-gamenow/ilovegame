// Read-only, no database writes or AI calls. Run manually when checking source compatibility.
import { collectSteamDiscoveries } from '../../lib/steam-discovery-source.js';
const sources=await collectSteamDiscoveries();
console.log(JSON.stringify(sources.map(({appid,title,description})=>({appid,title,descriptionLength:description.length})),null,2));
