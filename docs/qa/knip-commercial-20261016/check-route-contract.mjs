// Structural assertions for the existing CRM route contract; no page mounts,
// credentials, browser, network or database access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../../../src/routes/crmRoutes.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("crmRoutes.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = new Map();
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "Route") {
    const attrs = new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(a => [a.name.getText(ast), a.initializer]));
    const routePath = attrs.get("path");
    if (routePath && ts.isStringLiteral(routePath)) routes.set(routePath.text, attrs.get("element")?.expression);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
for (const [routePath, target] of [["leads", "/crm/empresas?estado=Lead"], ["prospectos", "/crm/empresas?estado=Prospecto"]]) {
  const element = routes.get(routePath);
  assert.ok(element && ts.isJsxSelfClosingElement(element));
  assert.equal(element.tagName.getText(ast), "Navigate");
  const attrs = new Map(element.attributes.properties.filter(ts.isJsxAttribute).map(a => [a.name.getText(ast), a.initializer]));
  assert.equal(attrs.get("to")?.text, target);
  assert.ok(attrs.has("replace"));
  assert.equal(attrs.get("replace"), undefined);
}
const detail = routes.get("leads/:id");
assert.ok(detail && ts.isJsxSelfClosingElement(detail));
assert.equal(detail.tagName.getText(ast), "LeadDetalle");
console.log("PASS: leads/prospectos redirect to the exact filtered Empresas URLs with replace; leads/:id retains LeadDetalle.");
