import {randomUUID,createHash} from 'node:crypto';
export const statuses=['inbox','active','review','done'];
export const statusLabels={inbox:'Inbox',active:'In progress',review:'In review',done:'Done'};
export const priorities=['low','normal','high'];
export const owners=['Unassigned','Operations','Scheduling','Sales','Support'];
export const projects=['Customer experience','Business operations','Delivery'];
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function text(value,label,max,optional=false){
  if(optional && (value===undefined || value===''))return '';
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(label+' must contain 1–'+max+' characters.');
  return value.trim();
}
export function choice(value,options,label){if(!options.includes(value))fail('Choose a valid '+label+'.');return value;}
export function date(value){
  if(value===undefined||value==='')return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('Use a valid due date.');
  const parsed=new Date(value+'T12:00:00Z');if(Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value)fail('Use a valid due date.');
  return value;
}
export function fields(body){
  return {title:text(body.title,'Title',140),description:text(body.description,'Description',4000,true),
    project:choice(body.project,projects,'project'),owner:choice(body.owner,owners,'owner'),priority:choice(body.priority,priorities,'priority'),dueDate:date(body.dueDate)};
}
export function event(db,task,type,detail,now=new Date().toISOString(),actor='Workspace operator'){
  if(db.events.length>=20000)fail('Local preview activity limit reached. Export this workspace before continuing.',409);
  db.events.unshift({id:randomUUID(),taskId:task.id,taskNumber:task.number,type,detail,actor,at:now});
}
export function createTask(db,body,source='Manual'){
  if(db.tasks.length>=2000)fail('Local preview task limit reached.',409);
  const f=fields(body);
  if(typeof body.requiresReview!=='boolean')fail('Choose whether human approval is required.');
  const now=new Date().toISOString();
  const task={id:randomUUID(),number:'DB-'+String(db.tasks.length+1).padStart(4,'0'),...f,requiresReview:body.requiresReview,status:'inbox',source,version:1,createdAt:now,updatedAt:now,approvedAt:null};
  db.tasks.unshift(task);event(db,task,'created','Request captured from '+source+'.',now,source==='Manual'?'Workspace operator':'Intake: '+source);return task;
}
export function findTask(db,id,version){
  const task=db.tasks.find(t=>t.id===id);if(!task)fail('Task not found.',404);
  if(!Number.isInteger(version)||task.version!==version)fail('This task changed in another view. Refresh and review the latest version.',409);
  return task;
}
function touch(task){task.version++;task.updatedAt=new Date().toISOString();}
export function updateTask(db,id,body){
  const task=findTask(db,id,body.version);if(task.status==='done')fail('Reopen this completed task before editing it.',409);
  const f=fields(body);Object.assign(task,f);touch(task);event(db,task,'updated','Task details updated.');return task;
}
export function act(db,id,body){
  const task=findTask(db,id,body.version),action=body.action;
  if(action==='comment'){
    const note=text(body.note,'Comment',2000);touch(task);event(db,task,'comment',note);return task;
  }
  if(action==='start'){if(task.status!=='inbox')fail('Only inbox tasks can be started.',409);task.status='active';}
  else if(action==='submit-review'){if(task.status!=='active')fail('Start the task before requesting review.',409);task.status='review';}
  else if(action==='approve'){if(task.status!=='review')fail('Only tasks in review can be approved.',409);task.status='done';task.approvedAt=new Date().toISOString();}
  else if(action==='request-changes'){if(task.status!=='review')fail('Only tasks in review can be returned.',409);text(body.note,'Review feedback',2000);task.status='active';}
  else if(action==='complete'){if(task.status!=='active'||task.requiresReview)fail('This task must pass human review before completion.',409);task.status='done';}
  else if(action==='reopen'){if(task.status!=='done')fail('Only completed tasks can be reopened.',409);task.status='active';task.approvedAt=null;}
  else fail('Choose a valid action.');
  touch(task);
  const descriptions={start:'Work started.','submit-review':'Submitted for human review.',approve:'Approved by the workspace operator.',complete:'Marked complete by the workspace operator.',reopen:'Reopened; previous approval cleared.','request-changes':'Changes requested: '+(body.note||'').trim()};
  event(db,task,action,descriptions[action]);return task;
}
export function intake(db,body){
  const source=text(body.source,'Source',80),externalId=text(body.externalId,'External ID',120);
  const normalized=fields(body);if(typeof body.requiresReview!=='boolean')fail('Choose whether human approval is required.');
  const hash=createHash('sha256').update(JSON.stringify({...normalized,requiresReview:body.requiresReview})).digest('hex');
  const old=db.receipts.find(r=>r.source===source&&r.externalId===externalId);
  if(old){if(old.hash!==hash)fail('External ID already exists with different content.',409);old.deliveries++;old.lastReceivedAt=new Date().toISOString();return {task:db.tasks.find(t=>t.id===old.taskId),receipt:old,duplicate:true};}
  const task=createTask(db,{...normalized,requiresReview:body.requiresReview},source);
  const receipt={id:randomUUID(),source,externalId,taskId:task.id,taskNumber:task.number,hash,deliveries:1,receivedAt:new Date().toISOString(),lastReceivedAt:new Date().toISOString()};
  db.receipts.unshift(receipt);return {task,receipt,duplicate:false};
}
export function metrics(tasks,today=new Date().toISOString().slice(0,10)){
  return {total:tasks.length,open:tasks.filter(t=>t.status!=='done').length,review:tasks.filter(t=>t.status==='review').length,done:tasks.filter(t=>t.status==='done').length,overdue:tasks.filter(t=>t.status!=='done'&&t.dueDate&&t.dueDate<today).length};
}
export const samples=[
  {externalId:'sample-appointment',title:'Review a new appointment request',description:'Fictional review fixture: a visitor asked for an appointment next Tuesday. Check availability before confirming externally.',project:projects[0],owner:'Scheduling',priority:'normal'},
  {externalId:'sample-quote',title:'Prepare an AI front-desk proposal',description:'Fictional review fixture: a business requested a quote. Review scope and pricing; no proposal is sent by this app.',project:projects[0],owner:'Sales',priority:'normal'},
  {externalId:'sample-callback',title:'Review a priority callback request',description:'Fictional review fixture: an existing customer requested a prompt callback. Human follow-up is required.',project:projects[0],owner:'Support',priority:'high'},
  {externalId:'sample-workflow',title:'Map the customer onboarding workflow',description:'Fictional review fixture: document intake, ownership, review points, and completion criteria.',project:projects[1],owner:'Operations',priority:'normal'},
  {externalId:'sample-release',title:'Review the integration acceptance checklist',description:'Fictional review fixture: verify duplicate delivery, failed writes, stale updates, and approval controls.',project:projects[2],owner:'Operations',priority:'low'}
].map(t=>({...t,source:'Sample workspace',dueDate:'',requiresReview:true}));

