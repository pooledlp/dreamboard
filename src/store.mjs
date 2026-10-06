import {mkdir,readFile,open,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function createStore(directory,{persist}={}){
  await mkdir(directory,{recursive:true});
  const file=resolve(directory,'workspace.json');
  let state;
  try{
    state=JSON.parse(await readFile(file,'utf8'));
    if(state.schemaVersion!==1||!Array.isArray(state.tasks)||!Array.isArray(state.events)||!Array.isArray(state.receipts))throw new Error('Unsupported or corrupt workspace. Restore from a verified backup.');
  }catch(e){if(e.code!=='ENOENT')throw e;state={schemaVersion:1,tasks:[],events:[],receipts:[]};}
  const save=persist||async function(next){
    const handle=await open(file+'.tmp','w');
    try{await handle.writeFile(JSON.stringify(next,null,2));await handle.sync();}finally{await handle.close();}
    await rename(file+'.tmp',file);
  };
  let queue=Promise.resolve();
  return {
    snapshot:()=>structuredClone(state),
    transaction(action){
      const job=queue.then(async()=>{const next=structuredClone(state),result=action(next);await save(next);state=next;return structuredClone(result);});
      queue=job.catch(()=>{});return job;
    }
  };
}

