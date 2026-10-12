// Host-side evidence assertions. No financial calculation or SQL replacement.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false; let closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closedQuote = true; }
      else field += c;
    } else if (c === '"') {
      assert(field === '' && !closedQuote, 'Invalid CSV quote'); quoted = true;
    } else if (c === ',') { row.push(field); field = ''; closedQuote = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; closedQuote = false;
    } else { assert(!closedQuote, 'Unexpected CSV text after closing quote'); field += c; }
  }
  assert(!quoted, 'Unterminated CSV quote');
  if (field !== '' || row.length || closedQuote) { row.push(field); rows.push(row); }
  assert(rows.length > 1, 'CSV data missing');
  const header = rows.shift();
  assert(new Set(header).size === header.length, 'Duplicate CSV column');
  return rows.map(values => {
    assert.equal(values.length, header.length, 'CSV column count differs');
    return Object.fromEntries(header.map((name, i) => [name, values[i]]));
  });
}

export function verifyMinimal(directory) {
  const results = parseCsv(fs.readFileSync(path.join(directory, 'results.csv'), 'utf8'));
  const metadata = parseCsv(fs.readFileSync(path.join(directory, 'metadata.csv'), 'utf8'));
  const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'));
  assert.equal(results.length, 48, 'Expected exactly 48 case-phase result rows');
  assert.equal(results.filter(x => x.phase === 'before').length, 24, 'Expected 24 before cases');
  assert.equal(results.filter(x => x.phase === 'after').length, 24, 'Expected 24 after cases');
  assert.equal(new Set(results.map(x => x.phase + ':' + x.label)).size, 48, 'Duplicate case-phase evidence');
  for (const row of results) assert.equal(row.passed, 't', `Failed result ${row.phase}:${row.label}`);
  assert.equal(metadata.length, 3, 'Expected exactly three metadata rows');
  assert.deepEqual(metadata.map(x => x.name).sort(), ['_nc_aplicadas_moneda_factura', '_saldo_factura_calc', 'nc_aplicadas_en_moneda_factura'].sort());
  for (const row of metadata) {
    assert.equal(row.preserved, 't', `Metadata not preserved: ${row.name}`);
    assert.equal(row.expected_fixture_security, 't', `Unexpected fixture ACL/security: ${row.name}`);
    assert.equal(row.inner_body_unchanged, 't', `Inner body changed: ${row.name}`);
    for (const field of ['oid', 'owner', 'acl', 'config', 'volatility', 'definer']) {
      assert.equal(row[`before_${field}`], row[`after_${field}`], `Changed ${field}: ${row.name}`);
      assert(row[`before_${field}`] !== undefined, `Missing metadata ${field}`);
    }
  }
  assert.equal(summary.status, 'pass');
  assert.equal(summary.cases_per_phase, 24);
  assert.equal(summary.case_phase_results, 48);
  assert.equal(summary.after_mismatches, 0);
  assert.equal(summary.case_failures, 0);
  assert(summary.before_expected_mismatches > 0, 'Replay mismatch was not demonstrated');
  assert.equal(summary.metadata_preserved, true);
  assert.equal(summary.inner_definition_unchanged, true);
  assert.equal(summary.data_unchanged, true);
  return { verifiedCasePhaseRows: 48, verifiedMetadataRows: 3, allPreserved: true };
}
