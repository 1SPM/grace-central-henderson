// Offline asset generation only. Never deployed as an HTTP endpoint.
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../apps/member-web/public');
async function main(){
 const phrases=JSON.parse(await fs.readFile(path.join(root,'shared/grace-demo-voice.json'),'utf8'));
 if(!process.env.ELEVENLABS_API_KEY)throw Error('Missing ElevenLabs key');
 await fs.mkdir(path.join(root,'assets/grace-clara-demo'),{recursive:true});
 for(let i=0;i<phrases.length;i++){
  const destination=path.join(root,`assets/grace-clara-demo/${i}.mp3`);
  try{if((await fs.stat(destination)).size>0)continue;}catch{}
  const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/Qggl4b0xRMiqOwhPtVWT/stream',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:phrases[i],model_id:'eleven_multilingual_v2'}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Clip ${i}: HTTP ${response.status}`);
  if(!response.headers.get('content-type')?.includes('audio'))throw Error('Not audio');
  await fs.writeFile(destination,Buffer.from(await response.arrayBuffer()));
  console.log(`Clara clip ${i+1}/${phrases.length} saved`);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
