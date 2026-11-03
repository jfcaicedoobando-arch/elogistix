const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto'),zlib=require('node:zlib');
const cp=require('node:child_process'),vm=require('node:vm');
const {createProfile}=require('../profile.cjs');
const {createEvidenceWriter}=require('../evidence.cjs');
const {createSnapshotter,sections}=require('../snapshots.cjs');
const {verifyRestoreEvidence}=require('../restore-evidence.cjs');
const restoreContract=require('../contract.json');
const restoreNotices=restoreContract.restore_evidence.notices;
const restoreEvidenceLog=notices=>notices.map(notice=>'psql:supabase/tests/insurance_trash_restore.sql:259: NOTICE:  '+notice).join('\n')+'\n';

test('restore evidence binds the reviewed successor, predecessor provenance and 64 retained plus 23 H14 assertions',()=>{
  const expected=restoreContract.restore_evidence;
  assert.equal(expected.file,'supabase/tests/insurance_trash_restore.sql');
  assert.equal(expected.pre_h14_sha256,'78f0c001eed881e51ffdae23c0ce736f40e2b23bd613099c8ebda0fd680c68ac');
  assert.equal(restoreContract.frozen_files[expected.file],'eb091562e677b5466129ae02af95ce4713acce999fde62b00e5cf2d13c07b25f');
  assert.equal(expected.retained_assertions,64);assert.equal(expected.h14_assertions,23);
  assert.equal(restoreNotices.length,87);
  assert.equal(restoreNotices.filter(notice=>/^PASS: (?:H14 |historical )/.test(notice)).length,23);
  assert.equal(restoreNotices.filter(notice=>notice==='PASS: H14 rejected parent tombstone preserves every header field').length,4);
});

for(const [label,format] of [
  ['plain',notice=>'NOTICE:  '+notice],
  ['psql source prefix',notice=>'psql:supabase/tests/insurance_trash_restore.sql:259: NOTICE:  '+notice],
  ['verbose SQLSTATE',notice=>'psql:supabase/tests/insurance_trash_restore.sql:259: NOTICE:  00000: '+notice+'\nLOCATION:  exec_stmt_raise, pl_exec.c:3911'],
])test('restore evidence accepts all 87 ordered notices with '+label,()=>{
  const log='BEGIN\r\n'+restoreNotices.map(format).join('\r\n')+'\r\nROLLBACK\r\n';
  assert.deepEqual(verifyRestoreEvidence(log),restoreNotices);
});

for(const label of [
  'gate is off before rejected wrong-tenant tombstone insert',
  'wrong-tenant tombstone INSERT is rejected by the exact composite FK [23503/insurance_pf_same_org_fk]',
  'rejected wrong-tenant tombstone insert preserves every existing policy row',
  'rejected wrong-tenant tombstone insert leaves restore gate off',
  'H14 rejects wrong-tenant tombstone INSERT with all guards active [42501/exact LC_FORBIDDEN]',
  'historical fixture parent has the exact deletion batch with H14 re-enabled',
])test('restore evidence rejects missing retained/H14 notice: '+label,()=>{
  const notices=[...restoreNotices],index=notices.indexOf('PASS: '+label);
  assert(index>=0);notices.splice(index,1);
  assert.throws(()=>verifyRestoreEvidence(restoreEvidenceLog(notices)),/exact 64 retained and 23 H14 assertions in order/);
});

for(const [label,mutate] of [
  ['extra PASS notice',notices=>notices.push('PASS: unexpected extra assertion')],
  ['extra non-PASS notice',notices=>notices.push('unexpected extra diagnostic')],
  ['duplicate replacing a different notice',notices=>{notices[1]=notices[0]}],
  ['reordered different notices',notices=>{[notices[0],notices[1]]=[notices[1],notices[0]]}],
])test('restore evidence rejects '+label,()=>{
  const notices=[...restoreNotices];mutate(notices);
  assert.throws(()=>verifyRestoreEvidence(restoreEvidenceLog(notices)),/exact 64 retained and 23 H14 assertions in order/);
});

test('restore evidence rejects a notice whose payload moves to the next line',()=>{
  const log=restoreEvidenceLog(restoreNotices).replace('NOTICE:  PASS:','NOTICE:  \nPASS:');
  assert.throws(()=>verifyRestoreEvidence(log),/exact 64 retained and 23 H14 assertions in order/);
});

for(const severity of ['ERROR','FATAL','PANIC'])test('restore evidence rejects SQL '+severity+' despite all 87 notices',()=>{
  const log=restoreEvidenceLog(restoreNotices)+'psql:supabase/tests/insurance_trash_restore.sql:259: '+severity+':  XX000: synthetic failure\n';
  assert.throws(()=>verifyRestoreEvidence(log),/contains a SQL error/);
});

test('actual runner verifies the existing manifest restore log before its first database operation',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../run.cjs'),'utf8');
  const check=source.slice(source.indexOf('// Inspect the existing manifest guard'),source.indexOf('\nadmin=new Client'));
  const log=restoreEvidenceLog(restoreNotices),reads=[],verified=[],passed=[];
  const context={path,assert,process:{env:{SELECTOR148_GUARD_LOG_DIR:'/synthetic/guards-logs'}},
    fs:{readFileSync(file,encoding){reads.push([file,encoding]);return log}},
    verifyRestoreEvidence(actual){verified.push(actual);return verifyRestoreEvidence(actual)},
    pass(message){passed.push(message)}};
  vm.runInNewContext(check,context);
  assert.deepEqual(reads,[['/synthetic/guards-logs/insurance_trash_restore.log','utf8']]);
  assert.deepEqual(verified,[log]);
  assert.deepEqual(passed,['manifest restore successor completed 64 retained assertions and 23 H14 admission/atomicity assertions']);
});

test('profiling preserves sync/async values, errors and measures nested operations without summing wall',async()=>{
  let now=0;const error=new Error('synthetic');
  const p=createProfile({clock:()=>now++,cpu:()=>({user:1000,system:2000}),memory:()=>({rss:100})});
  assert.equal(p.sync('success',()=>42,7),42);
  assert.throws(()=>p.sync('failure',()=>{throw error}),e=>e===error);
  assert.equal(await p.async('async',async()=>p.sync('nested',()=>6)),6);
  await assert.rejects(p.async('failure',async()=>{throw error}),e=>e===error);
  const r=p.report('FAIL');
  assert.equal(r.metrics.success.bytes,7);assert.equal(r.metrics.failure.count,2);
  assert.equal(r.metrics.failure.failures,2);assert.equal(r.metrics.nested.failures,0);
  assert(r.metrics.async.total_ms>r.metrics.nested.total_ms);
  assert.equal(r.sampled_peak_rss_bytes,100);assert.equal(r.cpu_user_ms,0);
  assert(!JSON.stringify(r).includes('synthetic'));
});

test('evidence retains exact legacy JSON, gzip level, bytes and hashes including duplicate snapshots',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'selector148-evidence-'));
  try {
    const p=createProfile(),save=createEvidenceWriter(directory,p);
    const value={one:'quotes " and newline\nUnicode: México 😀',two:[null,true,1.5,{a:'x'}]};
    const raw=JSON.stringify(value,null,2)+'\n',bytes=zlib.gzipSync(raw,{level:1});
    const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
    save('snapshot-a',value);save('snapshot-b',value);save('result',value);
    assert.equal(fs.readFileSync(path.join(directory,'result.json'),'utf8'),raw);
    for(const name of ['snapshot-a','snapshot-b']) {
      const actual=fs.readFileSync(path.join(directory,name+'.json.gz'));
      assert.deepEqual(actual,bytes);assert.equal(zlib.gunzipSync(actual).toString(),raw);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'snapshot-manifest.json'),'utf8'))[name],
        {raw_sha256:hash(raw),gzip_sha256:hash(bytes),raw_bytes:Buffer.byteLength(raw),gzip_bytes:bytes.length});
    }
    assert.equal(p.report('PASS').metrics['evidence.snapshot.write'].count,2);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('snapshot retains frozen SQL, section order, parse contract and serial data reset',async()=>{
  const calls=[],saved=[];let active=0;
  const p=createProfile();
  const snapshot=createSnapshotter({read:file=>'SELECT jsonb_pretty('+JSON.stringify(file)+')',
    save:(...args)=>saved.push(args),profile:p});
  const q={async query(query) {
    assert.equal(active++,0,'No parallel queries permitted');
    await Promise.resolve();active--;
    calls.push(query);if(query.startsWith('DROP FUNCTION'))return {};
    const value={text:query,array:[null,1,'á']};
    const result={rows:[{jsonb_pretty:JSON.stringify(value)}]};
    return query.includes('data.sql')?[{rows:[]},result]:result;
  }};
  const result=await snapshot(q,'synthetic');
  assert.deepEqual(Object.keys(result),sections);assert.equal(calls.length,10);
  assert.equal(calls[8],'DROP FUNCTION IF EXISTS pg_temp.snapshot_data()');
  assert.deepEqual(calls.filter(query=>!query.startsWith('DROP FUNCTION')),
    sections.map(section=>'SELECT jsonb_pretty('+JSON.stringify('fixtures/'+section+'.sql')+')'));
  assert.equal(saved.length,1);assert.equal(saved[0][0],'snapshot-synthetic');assert.equal(saved[0][1],result);
  assert.equal(p.report('PASS').metrics['snapshot.total'].count,1);
});

for(const response of [{rows:[]},{rows:[{jsonb_pretty:'invalid'}]},{rows:[{other:'[]'}]}])
test('snapshot retains legacy parsing failure: '+JSON.stringify(response),async()=>{
  const saved=[];
  const snap=createSnapshotter({read:()=>'SELECT jsonb_pretty(x)',save:v=>saved.push(v),profile:createProfile()});
  let expected;try{JSON.parse(response.rows[0].jsonb_pretty)}catch(error){expected=error}
  await assert.rejects(snap({query:async()=>response},'bad'),error=>error.constructor===expected.constructor&&error.message===expected.message);
  assert.equal(saved.length,0);
});

for(const value of [null,42,true,'[]'])test('snapshot retains legacy JSON.parse coercion: '+value,async()=>{
  const snap=createSnapshotter({read:()=>'SELECT jsonb_pretty(x)',save:()=>{},profile:createProfile()});
  const response={rows:[{jsonb_pretty:value,extra:'legacy ignores this'},{jsonb_pretty:'also ignored'}]};
  const result=await snap({query:async()=>response},'legacy');
  for(const section of sections)assert.deepEqual(result[section],JSON.parse(value));
});

test('SQL subprocess profiling remains independent of the expected-notice profile',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../run.cjs'),'utf8');
  const sqlFile=source.slice(source.indexOf('function sqlFile('),source.indexOf('async function failedInstall('));
  const writes=[];const profile=createProfile();
  const context={assert,profile,path,process:{env:{}},__dirname:'/synthetic',root:'/synthetic',E:'/synthetic',
    state:{databases:['owned']},expectations:{notices:['PASS: contract']},
    extractNotices:()=>['PASS: contract'],save:(...args)=>writes.push(args),fs:{writeFileSync(){}},
    cp:{spawnSync:()=>({stdout:'NOTICE: PASS: contract',stderr:'',status:0,signal:null})}};
  vm.runInNewContext(sqlFile+"sqlFile('owned','proof','test.sql','notices');",context);
  assert.equal(profile.report('PASS').metrics['process.psql'].count,1);
  assert.equal(writes[0][0],'proof.process');
});

for(const [label,command,expected] of [
  ['success',"printf 'kept stdout\\n'; printf 'kept stderr\\n' >&2",0],
  ['explicit failure','exit 7',7],
  ['pipeline failure','false | true',1],
])test('replay profiling preserves '+label+' and exact exit code',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'selector148-replay-'));
  try {
    const script=path.resolve(__dirname,'../profile-replay.sh');
    const run=cp.spawnSync('bash',['-euo','pipefail','-c',
      'source "$1"; replay_profile_init; trap \'replay_profile_finish "$?"\' EXIT; '+
      'replay_profile_begin bootstrap; replay_profile_begin migration/synthetic.sql; '+command,'test',script],
      {cwd:directory,encoding:'utf8'});
    assert.equal(run.status,expected,run.stderr);
    if(!expected){assert.equal(run.stdout,'kept stdout\n');assert.equal(run.stderr,'kept stderr\n');}
    const records=fs.readFileSync(path.join(directory,'.selector148-logs/replay-profile.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(records.map(row=>row.phase),['bootstrap','migration/synthetic.sql','total']);
    assert.equal(records[0].exit_code,0);assert.equal(records[1].exit_code,expected);assert.equal(records[2].exit_code,expected);
    assert(records.every(row=>row.clock_valid===true&&row.duration_us>=0));
    assert(records[2].duration_us>=records[0].duration_us+records[1].duration_us);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('replay profiling cannot hide original failure when metrics finalization fails',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'selector148-replay-'));
  try {
    const script=path.resolve(__dirname,'../profile-replay.sh');
    const run=cp.spawnSync('bash',['-euo','pipefail','-c',
      'source "$1"; replay_profile_init; trap \'replay_profile_finish "$?"\' EXIT; '+
      'replay_profile_begin bootstrap; REPLAY_PROFILE_FILE=missing/metrics.jsonl; exit 7','test',script],
      {cwd:directory,encoding:'utf8'});
    assert.equal(run.status,7);assert.match(run.stderr,/profiling incomplete/);assert(!run.stderr.includes('missing/metrics'));
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

for(const sensor of ['clock','cpu','memory'])for(const at of [1,3])
test(sensor+' failure at call '+at+' preserves values and original sync/async errors',async()=>{
  let calls=0;const warnings=[],error=new Error('original functional failure');
  const options={warn:message=>warnings.push(message)};
  options[sensor]=()=>{
    if(++calls>=at)throw new Error('private telemetry details must not leak');
    return sensor==='clock'?calls:sensor==='cpu'?{user:0,system:0}:{rss:100};
  };
  const profile=createProfile(options);
  assert.equal(profile.sync('success',()=>42),42);
  assert.throws(()=>profile.sync('failure',()=>{throw error}),actual=>actual===error);
  assert.equal(await profile.async('async-success',async()=>17),17);
  await assert.rejects(profile.async('async-failure',async()=>{throw error}),actual=>actual===error);
  // CPU sampling happens at init/report, so ensure the late sensor failure fires.
  profile.report('PASS');profile.report('PASS');
  const report=profile.report('FAIL');
  assert.equal(report.profiling_complete,false);assert.equal(report.wall_ms,null);
  assert.equal(warnings.length,1);assert.match(warnings[0],/profiling incomplete/);
  assert(!warnings[0].includes('private telemetry'));
});

for(const status of ['PASS','FAIL'])test('Node final metrics write failure preserves '+status,()=>{
  const warnings=[];
  const profile=createProfile({warn:message=>warnings.push(message),write(){throw new Error('private path')}});
  assert.equal(profile.writeReport('/synthetic',status),false);
  assert.equal(profile.report(status).status,status);
  assert.equal(profile.report(status).profiling_complete,false);
  assert.equal(warnings.length,1);assert(!warnings[0].includes('private path'));
});

for(const failed of [false,true])test('actual runner finalizer retains cleanup and original '+(failed?'error':'success')+' when profile.json is unwritable',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'selector148-finalizer-'));
  try {
    fs.mkdirSync(path.join(directory,'profile.json'));
    const warnings=[],calls=[],original=new Error('original runner failure');
    const state={exitCode:failed?7:undefined,env:{},versions:process.versions};
    const profile=createProfile({warn:message=>warnings.push(message)});
    const source=fs.readFileSync(path.join(__dirname,'../run.cjs'),'utf8');
    const finalizer=source.slice(source.lastIndexOf('.finally(async()=>'));
    const context={profile,path,E:directory,process:state,original,
      clients:[{async query(){calls.push('rollback')},async end(){calls.push('close')}}]};
    const result=vm.runInNewContext((failed?'Promise.reject(original)':'Promise.resolve(42)')+finalizer,context);
    if(failed)await assert.rejects(result,error=>error===original);else assert.equal(await result,42);
    assert.deepEqual(calls,['rollback','close']);assert.equal(state.exitCode,failed?7:undefined);
    assert.equal(warnings.length,1);assert.match(warnings[0],/profiling incomplete/);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('functional evidence write failures remain mandatory even after telemetry degrades',()=>{
  const profile=createProfile({clock(){throw new Error('metrics failure')},warn(){}});
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'selector148-required-evidence-'));
  try {
    fs.mkdirSync(path.join(directory,'snapshot-proof.json.gz'));
    const save=createEvidenceWriter(directory,profile);
    assert.throws(()=>save('snapshot-proof',{value:1}),{code:'EISDIR'});
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

for(const stage of ['init','phase','final'])for(const expected of [0,7])
test('Bash metrics '+stage+' failure retains execution and original exit '+expected,()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'selector148-metrics-failure-'));
  try {
    if(stage==='init')fs.mkdirSync(path.join(directory,'.selector148-logs/replay-profile.jsonl'),{recursive:true});
    const script=path.resolve(__dirname,'../profile-replay.sh');
    const run=cp.spawnSync('bash',['-euo','pipefail','-c',
      'source "$1"; replay_profile_init; trap \'replay_profile_finish "$?"\' EXIT; replay_profile_begin bootstrap; '+
      (stage==='phase'?'REPLAY_PROFILE_FILE=missing/metrics; replay_profile_begin squash; ':'')+
      (stage==='final'?'REPLAY_PROFILE_FILE=missing/metrics; ':'')+
      'printf reached; exit '+expected,'test',script],{cwd:directory,encoding:'utf8'});
    assert.equal(run.status,expected);assert.equal(run.stdout,'reached');
    assert.equal((run.stderr.match(/profiling incomplete/g)||[]).length,1);
    assert(!/missing\/metrics|Is a directory|No such file/.test(run.stderr));
    if(stage!=='init'){
      const content=fs.readFileSync(path.join(directory,'.selector148-logs/replay-profile.jsonl'),'utf8');
      assert(!content.includes('"profiling_complete":true'));
    }
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
