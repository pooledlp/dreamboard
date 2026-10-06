import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {createStore} from '../src/store.mjs';
import {createTask,updateTask,act,intake,metrics,date} from '../src/domain.mjs';

const sample={title:'Review fictional appointment',description:'Review fixture only',project:'Customer experience',owner:'Scheduling',priority:'normal',dueDate:'',requiresReview:true};
const blank=()=>({schemaVersion:1,tasks:[],events:[],receipts:[]});
const temp=()=>mkdtemp(join(process.env.TEST_TMPDIR||tmpdir(),'dreamboard-test-'));
const post=(body,method='POST')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const close=server=>new Promise(r=>server.close(r));
async function start(dataDir){const app=await createApp({dataDir});await new Promise(r=>app.listen(0,'127.0.0.1',r));return {app,url:'http://127.0.0.1:'+app.address().port};}

test('required review cannot be skipped; feedback and approval create history',()=>{
 const db=blank(),task=createTask(db,sample);
 assert.throws(()=>act(db,task.id,{version:1,action:'approve'}),{status:409});
 act(db,task.id,{version:1,action:'start'});
 assert.throws(()=>act(db,task.id,{version:2,action:'complete'}),{status:409});
 act(db,task.id,{version:2,action:'submit-review'});
 assert.throws(()=>act(db,task.id,{version:3,action:'request-changes',note:''}),{status:400});
 act(db,task.id,{version:3,action:'request-changes',note:'Please verify availability.'});
 assert.equal(task.status,'active');
 act(db,task.id,{version:4,action:'submit-review'});
 act(db,task.id,{version:5,action:'approve'});
 assert.equal(task.status,'done');assert.ok(task.approvedAt);
 assert.equal(db.events[0].type,'approve');assert.equal(db.events.length,6);
 assert.throws(()=>updateTask(db,task.id,{...sample,version:6}),{status:409});
 act(db,task.id,{version:6,action:'reopen'});assert.equal(task.approvedAt,null);
});

test('non-review tasks can be completed after starting',()=>{
 const db=blank(),task=createTask(db,{...sample,requiresReview:false});
 act(db,task.id,{version:1,action:'start'});act(db,task.id,{version:2,action:'complete'});
 assert.equal(task.status,'done');assert.equal(task.approvedAt,null);
});

test('intake deduplicates identical deliveries and rejects conflicting content',()=>{
 const db=blank(),payload={...sample,source:'AI Receptionist',externalId:'request-001'};
 const first=intake(db,payload),replay=intake(db,payload);
 assert.equal(first.task.id,replay.task.id);assert.equal(replay.duplicate,true);assert.equal(replay.receipt.deliveries,2);
 assert.throws(()=>intake(db,{...payload,title:'Different task'}),{status:409});
 assert.equal(db.tasks.length,1);assert.equal(db.events.length,1);
});

test('validation rejects invalid enums, malformed dates, and oversized fields',()=>{
 for(const changes of [{title:''},{title:'x'.repeat(141)},{description:'x'.repeat(4001)},{project:'unknown'},{owner:'unknown'},{priority:'urgent'},{requiresReview:'true'},{dueDate:'2026-02-30'}]){
  assert.throws(()=>createTask(blank(),{...sample,...changes}),{status:400});
 }
 assert.equal(date('2028-02-29'),'2028-02-29');
});

test('stale updates cannot silently overwrite a newer version',()=>{
 const db=blank(),task=createTask(db,sample);
 updateTask(db,task.id,{...sample,title:'Updated title',version:1});
 assert.throws(()=>updateTask(db,task.id,{...sample,title:'Stale title',version:1}),{status:409});
 assert.equal(task.title,'Updated title');assert.equal(task.version,2);
});

test('metrics reflect saved tasks and exclude completed tasks from overdue',()=>{
 const data=[{status:'active',dueDate:'2026-01-01'},{status:'review',dueDate:''},{status:'done',dueDate:'2026-01-01'}];
 assert.deepEqual(metrics(data,'2026-10-06'),{total:3,open:2,review:1,done:1,overdue:1});
});

test('failed persistence does not publish a change and later writes recover',async()=>{
 const dir=await temp();let failWrite=true;
 try{
  const store=await createStore(dir,{persist:async()=>{if(failWrite)throw new Error('Simulated disk failure');}});
  await assert.rejects(store.transaction(db=>createTask(db,sample)));
  assert.equal(store.snapshot().tasks.length,0);
  failWrite=false;await store.transaction(db=>createTask(db,sample));assert.equal(store.snapshot().tasks.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('corrupt existing storage fails closed instead of resetting records',async()=>{
 const dir=await temp();
 try{await writeFile(join(dir,'workspace.json'),'{"broken"');await assert.rejects(createStore(dir));}
 finally{await rm(dir,{recursive:true,force:true});}
});

test('HTTP intake, optimistic concurrency, and restart preserve one consistent workspace',async()=>{
 const dir=await temp();let session=await start(dir);
 try{
  const results=await Promise.all([fetch(session.url+'/api/tasks',post({...sample,submissionId:'manual-1'})),fetch(session.url+'/api/tasks',post({...sample,submissionId:'manual-1'}))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
  const task=(await results[0].json()).task;
  const updates=await Promise.all([fetch(session.url+'/api/tasks/'+task.id,post({...sample,title:'First writer',version:1},'PATCH')),fetch(session.url+'/api/tasks/'+task.id,post({...sample,title:'Second writer',version:1},'PATCH'))]);
  assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
  await close(session.app);session=await start(dir);
  const state=await (await fetch(session.url+'/api/workspace')).json();
  assert.equal(state.tasks.length,1);assert.equal(state.tasks[0].version,2);assert.equal(state.events.length,2);assert.equal(state.receipts[0].deliveries,2);
 }finally{await close(session.app);await rm(dir,{recursive:true,force:true});}
});

test('HTTP boundary blocks foreign origins, private files, invalid JSON, and oversized payloads',async()=>{
 const dir=await temp(),{app,url}=await start(dir);
 try{
  const foreign=post({...sample,submissionId:'foreign'});foreign.headers.Origin='https://untrusted.example';
  assert.equal((await fetch(url+'/api/tasks',foreign)).status,403);
  for(const path of ['/.env','/data/workspace.json','/src/store.mjs','/server.mjs'])assert.equal((await fetch(url+path)).status,404);
  assert.equal((await fetch(url+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'})).status,400);
  assert.equal((await fetch(url+'/api/tasks',post({text:'a'.repeat(17000)}))).status,413);
  assert.equal((await fetch(url+'/api/tasks',{method:'POST',body:'text'})).status,415);
  const state=await (await fetch(url+'/api/workspace')).json();assert.equal(state.tasks.length,0);
 }finally{await close(app);await rm(dir,{recursive:true,force:true});}
});

test('sample workspace is explicit, labeled, and repeat-safe',async()=>{
 const dir=await temp(),{app,url}=await start(dir);
 try{
  assert.equal((await (await fetch(url+'/api/workspace')).json()).tasks.length,0);
  assert.equal((await (await fetch(url+'/api/demo',post({}))).json()).created,5);
  assert.equal((await (await fetch(url+'/api/demo',post({}))).json()).created,0);
  const state=await (await fetch(url+'/api/workspace')).json();
  assert.equal(state.tasks.length,5);assert.ok(state.tasks.every(t=>t.source==='Sample workspace'));
 }finally{await close(app);await rm(dir,{recursive:true,force:true});}
});

