import {renderCarteraBatched} from './coordinator-web.js';
import {loadFixture} from './fixtures.mjs';
const $=id=>document.getElementById(id);
let controller=null, result=null, report=null, pdfUrl=null, generation=0;
function save(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function log(value){$('log').textContent+=JSON.stringify(value)+'\n';$('log').scrollTop=$('log').scrollHeight;}
$('cancel').onclick=()=>{if(controller&&!controller.signal.aborted){report.cancelReason='manual';report.cancelRequestedMs??=performance.now()-report.startedPerformanceMs;report.cancelPhase=report.currentPhase;controller.abort('manual');}};
$('pdf').onclick=()=>{if(result?.bytes)save(new Blob([result.bytes],{type:'application/pdf'}),`cartera-mock-${report.fixture}.pdf`);};
$('report').onclick=()=>{if(report)save(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),`cartera-mock-${report.fixture}-report.json`);};
$('run').onclick=async()=>{
 if(controller)return;
 const token=++generation, fixture=$('fixture').value, cancelMode=$('cancelMode').value;
 controller=new AbortController();const active=controller;result=null;report=null;
 if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl=null;}
 $('run').disabled=true;$('cancel').disabled=false;$('pdf').disabled=true;$('report').disabled=true;$('fixture').disabled=true;$('cancelMode').disabled=true;$('log').textContent='';
 const started=performance.now();let phase='setup';const timers=[];
 report={prototypeVersion:'portable-v1',fixture,cancelMode,status:'running',currentPhase:'setup',startedAt:new Date().toISOString(),startedPerformanceMs:started,userAgent:navigator.userAgent,platform:navigator.platform,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory??null,crossOriginIsolated,workerModel:'fresh sequential Web Workers; termination requested after each job',browserRssCapEnforced:false,timeoutMs:150000,events:[],memorySamplesMainThreadOnly:[]};
 const cancel=reason=>{if(active.signal.aborted)return;report.cancelReason=reason;report.cancelRequestedMs??=performance.now()-started;report.cancelPhase=report.currentPhase;active.abort(reason);};
 timers.push(setTimeout(()=>cancel('timeout-150s'),150000));
 const interval=setInterval(()=>{const elapsedMs=performance.now()-started;$('clock').textContent=(elapsedMs/1000).toFixed(1)+' s';if(performance.memory)report.memorySamplesMainThreadOnly.push({elapsedMs,usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit});},1000);
 try{
  if(cancelMode==='pre')cancel('pre-start');
  const props=await loadFixture(fixture,active.signal);if(active.signal.aborted)throw new DOMException('Cancelled','AbortError');
  report.fixtureRows=props.bloques.reduce((n,b)=>n+b.facturas.length,0);report.batchSize=fixture==='5001'?500:50;
  if(cancelMode==='render')timers.push(setTimeout(()=>cancel('render-5.5s'),5500));
  $('status').textContent='Generando lotes sintéticos...';
  phase='render';report.currentPhase=phase;
  const output=await renderCarteraBatched(props,{signal:active.signal,batchSize:report.batchSize,onProgress:event=>{const value={...event,elapsedMs:performance.now()-started};report.events.push(value);log(value);if(event.phase==='merge'){phase='merge';report.currentPhase=phase;$('status').textContent='Uniendo páginas y numeración global...';if(cancelMode==='merge')timers.push(setTimeout(()=>cancel('merge-50ms'),50));}else if(event.phase==='render'){phase='render';$('status').textContent=`Lote ${event.completed} de ${event.total}`;}}});
  if(active.signal.aborted||token!==generation)throw new DOMException('Cancelled','AbortError');
  result=output;report.status='complete';report.result={pages:output.pages,bytes:output.bytes.length,batches:output.batches,offsets:output.offsets,fontAudit:output.fontAudit,activeWorkers:output.activeWorkers,peakActiveWorkers:output.peakActiveWorkers,observerErrors:output.observerErrors};
  phase='hash';report.currentPhase=phase;
  report.pdfSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',output.bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(active.signal.aborted||token!==generation)throw new DOMException('Cancelled','AbortError');
  $('status').textContent=`Completado: ${output.pages} páginas, ${output.bytes.length.toLocaleString('es-MX')} bytes. Falta validar contenido/folios y memoria del navegador.`;$('pdf').disabled=false;
 }catch(error){result=null;report.status=active.signal.aborted?'cancelled':'error';report.error=String(error);report.phase=phase;report.outputAvailable=false;$('status').textContent=report.status==='cancelled'?'Cancelado. No se ofrece PDF parcial.':'Falló la prueba. Guarde el informe; no hay PDF.';log({status:report.status,error:String(error)});}
 finally{timers.forEach(clearTimeout);clearInterval(interval);report.elapsedMs=performance.now()-started;report.endedAt=new Date().toISOString();report.outputAvailable=Boolean(result);if(report.cancelRequestedMs!==undefined)report.cancelSettlementMs=report.elapsedMs-report.cancelRequestedMs;delete report.startedPerformanceMs;$('clock').textContent=(report.elapsedMs/1000).toFixed(2)+' s';controller=null;$('run').disabled=false;$('cancel').disabled=true;$('report').disabled=false;$('fixture').disabled=false;$('cancelMode').disabled=false;log({status:report.status,elapsedMs:report.elapsedMs});}
};
