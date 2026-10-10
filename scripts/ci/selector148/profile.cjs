// Aggregate timings only: no SQL, fixture rows, credentials or environment dump.
// Metrics are non-decisional. Only the supplied operation may change its result.
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const warning='WARNING: selector148 profiling incomplete; timing data must not be used as a complete measurement.';

function createProfile({clock=()=>performance.now(),cpu=()=>process.cpuUsage(),memory=()=>process.memoryUsage(),
  warn=message=>console.error(message),write=fs.writeFileSync}={}) {
  const metrics=new Map();let complete=true,peakRss=null;
  function disable() {
    if(complete){complete=false;try{warn(warning)}catch{}}
  }
  function observe(fn) {
    if(!complete)return undefined;
    try{return fn()}catch{disable();return undefined;}
  }
  const started=observe(clock),initialCpu=observe(cpu);
  observe(()=>{peakRss=memory().rss});
  function record(name,ms,failed=false,bytes) {return observe(()=>{
    const item=metrics.get(name)||{count:0,failures:0,total_ms:0,min_ms:Infinity,max_ms:0};
    item.count++;item.failures+=Number(failed);item.total_ms+=ms;
    item.min_ms=Math.min(item.min_ms,ms);item.max_ms=Math.max(item.max_ms,ms);
    if(bytes!==undefined)item.bytes=(item.bytes||0)+bytes;
    metrics.set(name,item);peakRss=Math.max(peakRss,memory().rss);
  });}
  function sync(name,fn,bytes) {
    const start=observe(clock);let failed=true;
    try { const result=fn();failed=false;return result; }
    finally {observe(()=>record(name,clock()-start,failed,bytes));}
  }
  async function async(name,fn) {
    const start=observe(clock);let failed=true;
    try { const result=await fn();failed=false;return result; }
    finally {observe(()=>record(name,clock()-start,failed));}
  }
  function report(status,metadata={}) {
    const used=observe(cpu),elapsed=observe(()=>clock()-started);
    return {schema_version:1,status,...metadata,profiling_complete:complete,
      wall_ms:complete?elapsed:null,
      cpu_user_ms:complete?(used.user-initialCpu.user)/1000:null,
      cpu_system_ms:complete?(used.system-initialCpu.system)/1000:null,
      sampled_peak_rss_bytes:complete?peakRss:null,
      // Nested operations overlap; incomplete reports retain only partial metrics.
      metrics:Object.fromEntries([...metrics].sort(([a],[b])=>a.localeCompare(b)))};
  }
  function writeReport(file,status,metadata) {
    try{write(file,JSON.stringify(report(status,metadata),null,2)+'\n');return true;}
    catch{disable();return false;}
  }
  return {sync,async,record,report,writeReport};
}
module.exports={createProfile};
