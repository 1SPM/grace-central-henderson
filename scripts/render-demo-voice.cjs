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
  // Claim the path atomically rather than checking and then writing. 'wx' fails
  // if the clip already exists, so there is no window between the two in which
  // the file could appear -- and skipping an existing clip matters, because each
  // one costs an API call.
  let handle;
  try{handle=await fs.open(destination,'wx');}
  catch(err){if(err.code==='EEXIST')continue;throw err;}
  try{
   // The phrases come from grace-demo-voice.json, which is committed to this
   // repo, and the response is written to a path built from the loop index --
   // never from anything the response says.
   const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/Qggl4b0xRMiqOwhPtVWT/stream',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:phrases[i],model_id:'eleven_multilingual_v2'}),signal:AbortSignal.timeout(30000)});  // codeql[js/file-access-to-http]
   if(!response.ok)throw Error(`Clip ${i}: HTTP ${response.status}`);
   if(!response.headers.get('content-type')?.includes('audio'))throw Error('Not audio');
   // codeql[js/http-to-file-access]
   await handle.write(Buffer.from(await response.arrayBuffer()));
   await handle.close();
  }catch(err){
   // Never leave an empty or half-written clip behind: with 'wx' it would block
   // every future retry of this index.
   await handle.close().catch(()=>null);
   await fs.unlink(destination).catch(()=>null);
   throw err;
  }
  console.log(`Clara clip ${i+1}/${phrases.length} saved`);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
