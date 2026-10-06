import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './src/store.mjs';
import {updateTask,act,intake,metrics,statuses,statusLabels,priorities,owners,projects,samples,fail} from './src/domain.mjs';
const root=dirname(fileURLToPath(import.meta.url));
export async function createApp({dataDir=resolve(root,'data'),store:injectedStore}={}){
  const store=injectedStore||await createStore(dataDir);
  const server=http.createServer(async(req,res)=>{
    const send=(status,payload,type='application/json')=>{
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
      res.end(type==='application/json'?JSON.stringify(payload):payload);
    };
    try{
      const host=req.headers.host;
      if(!['localhost:'+server.address().port,'127.0.0.1:'+server.address().port].includes(host))return send(403,{error:'Use the local workspace address.'});
      if(req.headers.origin&&req.headers.origin!=='http://'+host)return send(403,{error:'Cross-origin requests are not allowed.'});
      const path=new URL(req.url,'http://'+host).pathname;
      if(req.method==='GET'&&path==='/api/workspace'){
        const state=store.snapshot();return send(200,{...state,metrics:metrics(state.tasks),config:{statuses,statusLabels,priorities,owners,projects}});
      }
      if(req.method==='GET'&&['/','/app.js','/style.css','/favicon.svg'].includes(path)){
        const name=path==='/'?'index.html':path.slice(1),types={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml'};
        return send(200,await readFile(resolve(root,'public',name)),types[name.split('.').at(-1)]+'; charset=utf-8');
      }
      if(!['POST','PATCH'].includes(req.method))return send(404,{error:'Not found'});
      if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Send application/json.'});
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return send(413,{error:'Request too large.'});}
      let body;try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid JSON.'});}
      if(!body||Array.isArray(body)||typeof body!=='object')fail('Expected a JSON object.');
      if(req.method==='POST'&&path==='/api/tasks'){
        // Manual requests also use the receipt ledger for safe retries.
        const result=await store.transaction(db=>intake(db,{...body,source:'Manual',externalId:body.submissionId}));
        return send(result.duplicate?200:201,result);
      }
      if(req.method==='POST'&&path==='/api/intake'){
        const result=await store.transaction(db=>intake(db,body));return send(result.duplicate?200:201,result);
      }
      if(req.method==='POST'&&path==='/api/demo'){
        const result=await store.transaction(db=>samples.map(s=>intake(db,s)));return send(200,{created:result.filter(r=>!r.duplicate).length});
      }
      const match=path.match(/^\/api\/tasks\/([a-f0-9-]+)(\/actions)?$/);
      if(match&&req.method===(match[2]?'POST':'PATCH')){
        const result=await store.transaction(db=>match[2]?act(db,match[1],body):updateTask(db,match[1],body));return send(200,result);
      }
      return send(404,{error:'Not found'});
    }catch(e){
      if(!e.status)console.error('Workspace operation failed:',e.code||e.name);
      return send(e.status||500,{error:e.status?e.message:'The workspace could not save this change. Nothing was confirmed; please retry.'});
    }
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=await createApp();
  server.on('error',e=>{console.error('Cannot start Dreamboard:',e.code||e.message);process.exitCode=1;});
  server.listen(Number(process.env.PORT)||4320,'127.0.0.1',()=>console.log('Dreamboard: http://127.0.0.1:'+server.address().port));
}

