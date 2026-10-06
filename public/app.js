const $=selector=>document.querySelector(selector);
let workspace={tasks:[],events:[],receipts:[],metrics:{},config:{}};
let createKey=crypto.randomUUID(),mutationPending=false;
const views={
 overview:['Overview','YOUR OPERATIONS, IN FOCUS','Make room for <em>good work.</em>','A clear view of what’s moving, what needs you, and what comes next.'],
 board:['Work board','FROM INTAKE TO OUTCOME','Every task. <em>A clear next step.</em>','Organize the work, keep ownership clear, and follow it through.'],
 approvals:['Approvals','HUMAN JUDGMENT, BUILT IN','The work moves. <em>You decide.</em>','Review requests before completion and return anything that needs more attention.'],
 activity:['Activity','A SHARED RECORD','Follow the <em>whole story.</em>','A chronological record of the decisions and updates behind the work.'],
 integrations:['Integrations','A CONNECTED WORKSPACE','Bring the work <em>together.</em>','A consistent intake contract, durable receipts, and a clear destination.']
};
function node(tag,text,cls){const element=document.createElement(tag);if(text!==undefined)element.textContent=String(text);if(cls)element.className=cls;return element;}
function button(text,cls,handler){const el=node('button',text,cls);el.type='button';el.onclick=handler;return el;}
function notice(text,error=false){$('#notice').textContent=text;$('#notice').className=error?'error':'';}
async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 const data=await response.json();if(!response.ok){const e=new Error(data.error||'Workspace request failed.');e.status=response.status;throw e;}return data;
}
function dateLabel(value){return value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'No due date';}
function overdue(task){return task.status!=='done'&&task.dueDate&&task.dueDate<new Date().toISOString().slice(0,10);}
function show(view){
 for(const key of Object.keys(views))$('#'+key+'-view').hidden=key!==view;
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('#breadcrumb').textContent=views[view][0];$('#eyebrow').textContent=views[view][1];$('#heading').innerHTML=views[view][2];$('#subheading').textContent=views[view][3];
}
function fillFilter(selector,values,label){const el=$(selector),old=el.value;el.replaceChildren();const all=node('option',label);all.value='';el.append(all);for(const value of values){const o=node('option',value);o.value=value;el.append(o);}el.value=values.includes(old)?old:'';}
async function refresh(){
 workspace=await api('/api/workspace');
 fillFilter('#owner-filter',workspace.config.owners,'All owners');fillFilter('#project-filter',workspace.config.projects,'All projects');render();
}
function empty(text,action){const n=node('div',undefined,'empty');n.append(node('div','◈','empty-icon'),node('strong',text));if(action)n.append(button(action.label,'secondary',action.run));return n;}
function timeline(events,target){
 target.replaceChildren();
 if(!events.length){target.append(empty('Activity will appear as your team works.'));return;}
 for(const item of events){
  const row=node('div',undefined,'timeline-item'),copy=node('div');
  copy.append(button(item.taskNumber,'',()=>openTask(item.taskId)),node('p',item.detail),node('small',item.actor+' · '+new Date(item.at).toLocaleString()));
  row.append(node('span',undefined,'timeline-dot'),copy);target.append(row);
 }
}
function render(){
 $('#nav-open').textContent=workspace.metrics.open;$('#nav-review').textContent=workspace.metrics.review;
 $('#metrics').replaceChildren();
 for(const [label,key,symbol,foot] of [['Open tasks','open','▦','Across your workspace'],['Awaiting review','review','◎','Ready for a human decision'],['Completed','done','↗','Saved as done'],['Overdue','overdue','◷','Open tasks past their due date']]){
  const metric=node('article',undefined,'metric '+(key==='review'?'review':''));
  const top=node('div',undefined,'metric-top');top.append(node('span',label),node('span',symbol));
  metric.append(top,node('strong',workspace.metrics[key]),node('small',foot));$('#metrics').append(metric);
 }
 const attention=workspace.tasks.filter(t=>t.status!=='done').sort((a,b)=>Number(b.status==='review')-Number(a.status==='review')||Number(!!overdue(b))-Number(!!overdue(a))||Number(b.priority==='high')-Number(a.priority==='high')).slice(0,5);
 $('#attention').replaceChildren();
 if(!attention.length)$('#attention').append(empty(workspace.tasks.length?'Nothing waiting on you.':'Your workspace starts here.',{label:'Create your first task',run:openCreate}));
 for(const task of attention){
  const row=button('','focus-row',()=>openTask(task.id)),copy=node('span',undefined,'focus-copy');
  copy.append(node('strong',task.title),node('small',task.number+' · '+task.owner+' · '+dateLabel(task.dueDate)));
  row.append(node('span',task.status==='review'?'◎':'▦','status-symbol'),copy,node('span',workspace.config.statusLabels[task.status],'pill '+task.status),node('span','↗','arrow'));$('#attention').append(row);
 }
 $('#pulse').replaceChildren();
 for(const status of workspace.config.statuses){
  const count=workspace.tasks.filter(t=>t.status===status).length,row=node('div',undefined,'pulse-row'),track=node('div',undefined,'pulse-track'),progress=node('progress');
  progress.max=Math.max(workspace.tasks.length,1);progress.value=count;progress.setAttribute('aria-label',workspace.config.statusLabels[status]);
  track.append(progress);row.append(node('span',workspace.config.statusLabels[status]),track,node('span',count));$('#pulse').append(row);
 }
 timeline(workspace.events.slice(0,4),$('#recent'));timeline(workspace.events,$('#activity'));renderBoard();renderApprovals();renderReceipts();
}
function renderBoard(){
 if(!workspace.config.statuses)return;
 const query=$('#search').value.toLowerCase().trim(),project=$('#project-filter').value,owner=$('#owner-filter').value;
 const filtered=workspace.tasks.filter(t=>(!project||t.project===project)&&(!owner||t.owner===owner)&&(!query||(t.title+' '+t.description+' '+t.number).toLowerCase().includes(query)));
 $('#result-count').textContent=filtered.length+' tasks';$('#board').replaceChildren();
 for(const status of workspace.config.statuses){
  const list=filtered.filter(t=>t.status===status),column=node('div',undefined,'column '+status),heading=node('h2');
  heading.append(node('span',undefined,'stage-dot'),node('span',workspace.config.statusLabels[status]),node('i',list.length));column.append(heading);
  for(const task of list){
   const card=button('','task-card',()=>openTask(task.id));card.setAttribute('aria-label','Open '+task.number+': '+task.title);
   const top=node('div',undefined,'card-top');top.append(node('span',task.number,'task-id'),node('span',task.priority,'pill '+task.priority));
   const bottom=node('div',undefined,'card-bottom'),person=node('span',undefined,'owner-label');
   person.append(node('span',task.owner.slice(0,2).toUpperCase(),'owner-avatar'),node('span',task.owner));
   bottom.append(person,node('span',dateLabel(task.dueDate),overdue(task)?'overdue':''));
   card.append(top,node('h3',task.title),node('div',task.project+(task.requiresReview?' · Review required':''),'project'),bottom);column.append(card);
  }
  if(!list.length)column.append(node('div',query||project||owner?'No matching tasks.':'Work will appear here.','empty'));$('#board').append(column);
 }
}
function renderApprovals(){
 $('#approvals').replaceChildren();const tasks=workspace.tasks.filter(t=>t.status==='review');
 if(!tasks.length){$('#approvals').append(empty('You’re all caught up. No tasks awaiting review.'));return;}
 for(const task of tasks){const card=node('article',undefined,'approval-card'),copy=node('div');copy.append(node('span',task.number+' · '+task.project,'task-id'),node('h3',task.title),node('p',task.owner+' · '+task.priority+' priority'));card.append(copy,button('Review task →','primary',()=>openTask(task.id)));$('#approvals').append(card);}
}
function renderReceipts(){
 $('#receipts').replaceChildren();if(!workspace.receipts.length){$('#receipts').append(empty('No intake received yet.'));return;}
 for(const receipt of workspace.receipts.slice(0,100)){
  const row=node('div',undefined,'receipt'),source=node('div',receipt.source),task=node('div'),delivery=node('div');
  source.append(node('small',receipt.externalId));task.append(button(receipt.taskNumber,'text-button',()=>openTask(receipt.taskId)),node('small','Saved task'));
  delivery.textContent=receipt.deliveries+' accepted '+(receipt.deliveries===1?'delivery':'deliveries');delivery.append(node('small',new Date(receipt.lastReceivedAt).toLocaleString()));row.append(source,task,delivery);$('#receipts').append(row);
 }
}
function field(label,name,type,value,options){
 const wrapper=node('label',label);let input;
 if(options){input=node('select');for(const option of options){const opt=node('option',option);opt.value=option;input.append(opt);}}
 else if(type==='textarea'){input=node('textarea');input.rows=4;input.maxLength=4000;}
 else{input=node('input');input.type=type;}
 input.name=name;input.value=value||'';if(name==='title'){input.required=true;input.maxLength=140;}
 if(name==='dueDate'){input.min='2000-01-01';input.max='2200-12-31';}
 wrapper.append(input);return wrapper;
}
function taskForm(task){
 const form=node('form'),grid=node('div',undefined,'form-grid'),title=field('Task title','title','text',task?.title),description=field('Context & next step','description','textarea',task?.description);
 title.className=description.className='full-field';
 grid.append(title,description,field('Project','project','',task?.project||workspace.config.projects[0],workspace.config.projects),field('Owner','owner','',task?.owner||'Unassigned',workspace.config.owners),field('Priority','priority','',task?.priority||'normal',workspace.config.priorities),field('Due date','dueDate','date',task?.dueDate));
 form.append(grid);
 if(!task){
  const review=node('label',undefined,'check-label'),input=node('input');input.type='checkbox';input.name='requiresReview';input.checked=true;
  review.append(input,node('span','Require human approval before completion. This requirement cannot be removed after creation.'));form.append(review);
 }else form.append(node('p',task.requiresReview?'Human approval is required before completion.':'This task can be completed by the workspace operator.','form-note'));
 const err=node('p',undefined,'inline-error');err.setAttribute('role','alert');
 const footer=node('div',undefined,'form-footer');footer.append(node('small','Saved to this local workspace'));
 const save=node('button',task?'Save changes →':'Create task →','primary');save.type='submit';footer.append(save);form.append(err,footer);
 form.onsubmit=async e=>{
  e.preventDefault();if(mutationPending)return;mutationPending=true;save.disabled=true;
  const body=Object.fromEntries(new FormData(form));
  try{
   let result;if(task)result=await api('/api/tasks/'+task.id,{method:'PATCH',body:JSON.stringify({...body,version:task.version})});
   else result=(await api('/api/tasks',{method:'POST',body:JSON.stringify({...body,requiresReview:form.elements.requiresReview.checked,submissionId:createKey})})).task;
   if(!task)createKey=crypto.randomUUID();
   $('#task-dialog').close();
   try{await refresh();notice((task?'Updated ':'Created ')+result.number+'.');}catch{notice('Task saved. Refresh the workspace to see the latest state.',true);}
  }catch(e){err.textContent=e.message+(e.status===409?' Close this panel and refresh before retrying.':'');}
  finally{mutationPending=false;save.disabled=false;}
 };
 return form;
}
function openCreate(){
 if(!workspace.config.projects){notice('Wait for the workspace to connect.',true);return;}
 createKey=crypto.randomUUID();
 $('#dialog-label').textContent='DREAMBOARD / NEW TASK';$('#dialog-body').replaceChildren(node('h2','Start with a clear next step.'),taskForm());$('#task-dialog').showModal();
}
async function perform(task,action,note,error,controls){
 if(mutationPending)return;mutationPending=true;controls.forEach(b=>b.disabled=true);
 try{
  await api('/api/tasks/'+task.id+'/actions',{method:'POST',body:JSON.stringify({action,version:task.version,note})});
  await refresh();openTask(task.id);notice('Task updated.');
 }catch(e){error.textContent=e.message+(e.status===409?' Close this panel and refresh to load the latest version.':'');}
 finally{mutationPending=false;controls.forEach(b=>b.disabled=false);}
}
function openTask(id){
 const task=workspace.tasks.find(t=>t.id===id);if(!task)return;
 $('#dialog-label').textContent=task.number+' / '+workspace.config.statusLabels[task.status];
 const area=$('#dialog-body');area.replaceChildren(node('h2',task.title));
 const meta=node('div',undefined,'detail-meta');for(const label of [task.project,task.owner,task.priority+' priority',task.requiresReview?'Approval required':'Operator completion'])meta.append(node('span',label,'pill'));
 area.append(meta,node('p',task.description||'No additional context.','detail-description'),node('p','Due: '+dateLabel(task.dueDate)+' · Source: '+task.source+' · Version '+task.version,'form-note'));
 const actions=node('div',undefined,'detail-actions'),error=node('p',undefined,'inline-error');error.setAttribute('role','alert');
 const controls=[];
 const addAction=(label,action)=>{const b=button(label,'primary',()=>perform(task,action,'',error,controls));controls.push(b);actions.append(b);};
 if(task.status==='inbox')addAction('Start work →','start');
 if(task.status==='active'){addAction('Send for review →','submit-review');if(!task.requiresReview)addAction('Mark complete ✓','complete');}
 if(task.status==='review')addAction('Approve & complete ✓','approve');
 if(task.status==='done')addAction('Reopen task ↗','reopen');
 if(task.status!=='done'){
  const edit=button('Edit details','secondary',()=>{$('#dialog-body').replaceChildren(node('h2','Edit '+task.number),taskForm(task));});
  controls.push(edit);actions.append(edit);
 }
 area.append(actions,error);
 if(task.status==='review'){
  const form=node('form',undefined,'detail-section'),label=field('Feedback for the next revision','note','textarea','');label.querySelector('textarea').required=true;label.querySelector('textarea').maxLength=2000;
  const submit=node('button','Request changes →','secondary');submit.type='submit';controls.push(submit);form.append(label,submit);
  form.onsubmit=e=>{e.preventDefault();perform(task,'request-changes',form.elements.note.value,error,controls);};area.append(form);
 }
 const section=node('div',undefined,'detail-section');section.append(node('h3','Activity & discussion'));const history=node('div',undefined,'event-list');timeline(workspace.events.filter(e=>e.taskId===id),history);section.append(history);
 const comment=node('form',undefined,'comment-form'),label=field('Add a comment','note','text','');label.querySelector('input').maxLength=2000;label.querySelector('input').required=true;
 const send=node('button','Add comment','secondary');send.type='submit';controls.push(send);comment.append(label,send);
 comment.onsubmit=e=>{e.preventDefault();perform(task,'comment',comment.elements.note.value,error,controls);};section.append(comment);area.append(section);
 if(!$('#task-dialog').open)$('#task-dialog').showModal();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{show(b.dataset.view);notice('');});
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#new-task').onclick=openCreate;
$('#close-dialog').onclick=()=>{if(!mutationPending)$('#task-dialog').close();};
$('#task-dialog').addEventListener('cancel',e=>{if(mutationPending)e.preventDefault();});
$('#search').oninput=renderBoard;$('#owner-filter').onchange=renderBoard;$('#project-filter').onchange=renderBoard;
$('#clear-filters').onclick=()=>{$('#search').value='';$('#owner-filter').value='';$('#project-filter').value='';renderBoard();};
$('#refresh').onclick=async()=>{try{await refresh();notice('Workspace is up to date.');}catch(e){notice(e.message,true);}};
$('#load-samples').onclick=async()=>{
 const b=$('#load-samples');b.disabled=true;
 try{const r=await api('/api/demo',{method:'POST',body:'{}'});await refresh();show('board');notice(r.created?r.created+' fictional sample tasks added.':'Sample tasks already exist. No duplicates added.');}
 catch(e){notice(e.message,true);}finally{b.disabled=false;}
};
$('#export').onclick=async()=>{
 try{
  const fresh=await api('/api/workspace');const data={schemaVersion:fresh.schemaVersion,exportedAt:new Date().toISOString(),tasks:fresh.tasks,events:fresh.events,receipts:fresh.receipts};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='dreamboard-workspace-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Workspace export downloaded.');
 }catch(e){notice(e.message,true);}
};
refresh().catch(e=>notice('Unable to load Dreamboard: '+e.message,true));

