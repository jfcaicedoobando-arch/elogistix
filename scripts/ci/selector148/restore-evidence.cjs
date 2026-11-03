// Pure validation of the existing manifest guard's reviewed evidence; no SQL runs.
const assert=require('node:assert/strict');
const {restore_evidence:expected}=require('./contract.json');

function verifyRestoreEvidence(log) {
  assert.equal(typeof log,'string');
  assert(!/\b(?:ERROR|FATAL|PANIC):/.test(log),'Restore successor contains a SQL error');
  assert.equal(expected.notices.length,expected.retained_assertions+expected.h14_assertions);
  // psql may add a source/line prefix and verbose SQLSTATE. Keep every NOTICE,
  // including non-PASS messages, and never let whitespace cross a line boundary.
  const notices=log.split(/\r?\n/).filter(line=>/\bNOTICE:/.test(line)).map(line=>{
    const notice=line.match(/\bNOTICE:[ \t]+(?:[A-Z0-9]{5}:[ \t]+)?([^\r\n]*)$/);
    assert(notice,'Malformed restore successor notice');
    return notice[1];
  });
  // Historical-parent labels repeat legitimately; exact order also pins counts.
  assert.deepEqual(notices,expected.notices,'Restore successor must finish the exact 64 retained and 23 H14 assertions in order');
  return notices;
}

module.exports={verifyRestoreEvidence};
