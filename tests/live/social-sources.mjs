// Explicit, read-only feasibility check. Not wired into cron, CI or production routes.
import { probeBlueskyOfficialPosts } from '../../lib/social-source-probe.js';
if(process.argv.length!==3||process.argv[2]!=='--bluesky'){
  console.error('Usage: node tests/live/social-sources.mjs --bluesky');process.exitCode=1;
}else{
  try{console.log(JSON.stringify(await probeBlueskyOfficialPosts(),null,2));}
  catch{console.error('Bluesky public read failed. No retries, credentials, database writes or paid API calls.');process.exitCode=1;}
}
