import assert from 'node:assert/strict';
const jobs=JSON.parse(process.env.RESULTS);
for(const name of ['changes','quality','lint','tests','secrets']) assert.equal(jobs[name]?.result,'success',name+' must succeed');
for(const [job,flag] of [['database','database'],['edge','edge']]) {
  const required=jobs.changes.outputs[flag];
  assert.ok(['true','false'].includes(required),'Missing '+flag+' decision');
  assert.equal(jobs[job]?.result,required==='true'?'success':'skipped',job+' has unexpected result');
}

