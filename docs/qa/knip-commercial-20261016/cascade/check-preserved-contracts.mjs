import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";

const base = "c1d86c349b80faa7489d250440924ea77848c57d";
const checks = {
  "src/features/crm/services/crmCsvExport.ts": ["buildLeadsCsv", "buildOportunidadesCsv", "sufijoFechaArchivo", "exportarOportunidadesCsv"],
  "src/features/crm/domain/leads/constants.ts": ["LeadSortKey", "LeadFiltros", "LEAD_COLUMNS"],
  "src/features/crm/services/leads/queries.ts": ["aplicarFiltrosLeads", "listLeads", "getLead", "getNombreLead"],
};
const hash = source => createHash("sha256").update(source).digest("hex");
function declarations(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const result = new Map();
  for (const node of ast.statements) {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) result.set(declaration.name.getText(ast), declaration.getText(ast));
    } else if (node.name) result.set(node.name.getText(ast), node.getText(ast));
  }
  return result;
}
const result = [];
for (const [file, names] of Object.entries(checks)) {
  const before = declarations(file, execFileSync("git", ["show", `${base}:${file}`], {encoding:"utf8"}));
  const after = declarations(file, readFileSync(file, "utf8"));
  for (const name of names) {
    assert.ok(before.has(name) && after.has(name), `${file}: ${name} missing`);
    assert.equal(after.get(name), before.get(name), `${file}: ${name} changed`);
    result.push({file, name, sha256:hash(after.get(name))});
  }
}
for (const file of [
  "src/routes/crmRoutes.tsx",
  "src/features/crm/components/QuickAddMenu.tsx",
  "src/features/crm/components/quickCreate/QuickAddFullDialogs.tsx",
  "src/features/crm/components/ImportarLeadsCsvDialog.tsx",
]) {
  const before = execFileSync("git", ["show", `${base}:${file}`]);
  const after = readFileSync(file);
  assert.ok(before.equals(after), `${file}: protected file changed`);
  result.push({file, sha256:hash(after)});
}
writeFileSync(new URL("preserved-contracts.json", import.meta.url), JSON.stringify({base, result}, null, 2) + "\n");
console.log(`PASS: ${result.length} protected declarations/files identical to base; redirects/LeadDetalle and QuickAdd/import dialog unchanged.`);
