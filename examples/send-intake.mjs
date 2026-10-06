import {readFile} from 'node:fs/promises';
const payload=await readFile(new URL('./intake.json',import.meta.url),'utf8');
const response=await fetch('http://127.0.0.1:4320/api/intake',{
  method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(5000)
});
const result=await response.json();
if(!response.ok){console.error(result.error);process.exitCode=1;}
else console.log(JSON.stringify({task:result.task.number,duplicate:result.duplicate,deliveries:result.receipt.deliveries},null,2));

