import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const before = read(path.join(here, 'before.json'));
const after = read(path.join(here, 'after.json'));
const fixed = read(path.join(here, '../knip-scoped-cleanup-20261016/after.json'));
const scope = new Set([
  'src/hooks/shared/index.ts',
  'src/lib/domain/etiquetaCicloProforma.ts',
  'src/features/catalogos/services/index.ts',
  'src/features/admin/services/organization/index.ts',
  'src/features/dashboardEjecutivo/components/kpiValuacion.ts',
  'src/features/dashboardEjecutivo/services/completitud.ts',
  'src/features/admin/services/usuario/mutaciones.auth.ts',
  'src/features/marketing/lib/attribution.ts',
  'src/components/shared/DataTable.tsx',
  'src/lib/domain/documentoEstados.ts',
  'src/lib/financial/usoCfdiFiscal.ts',
  'src/features/auditoria/utils/diffConceptos.ts',
  'src/features/auditoria/utils/diffFields.ts',
  'src/features/reportes/components/ReportesTablaClientes.tsx',
  'src/features/auditoria/hooks/useOrgMembersAsignables.ts',
  'src/components/shared/documento/DocumentoKpiStrip.tsx',
]);
const findings = report => report.issues.flatMap(issue =>
  ['exports', 'types'].flatMap(kind => issue[kind].map(symbol =>
    JSON.stringify({ file: issue.file, kind, ...symbol })))).sort();
const counts = report => report.issues.reduce((totals, issue) => {
  for (const [kind, values] of Object.entries(issue)) {
    if (Array.isArray(values)) totals[kind] = (totals[kind] ?? 0) + values.length;
  }
  return totals;
}, {});
assert.deepEqual(findings(before), findings(fixed), 'Baseline differs from fixed inventory');
assert.deepEqual(
  findings(after),
  findings({ issues: before.issues.filter(issue => !scope.has(issue.file)) }),
  'Unexpected added, changed, or retained finding',
);
assert.equal(counts(before).exports - counts(after).exports, 11);
assert.equal(counts(before).types - counts(after).types, 13);
for (const report of [before, after]) {
  for (const [kind, total] of Object.entries(counts(report))) {
    if (kind !== 'exports' && kind !== 'types') assert.equal(total, 0, kind);
  }
}
console.log(JSON.stringify({
  baselineMatchesFixed: true,
  otherGroupsUnchangedIncludingLocations: true,
  assignedFindingsRemaining: 0,
  before: counts(before),
  after: counts(after),
  removedExports: 11,
  removedTypes: 13,
  removedTotal: 24,
}, null, 2));
