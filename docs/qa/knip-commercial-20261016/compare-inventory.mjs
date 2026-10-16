import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const categories = ["files", "dependencies", "devDependencies", "unlisted", "duplicates", "exports", "types"];
function inventory(data, locations = false) {
  return data.issues.flatMap(issue => categories.flatMap(kind => (issue[kind] ?? []).map(symbol => ({
    file: issue.file, kind, name: typeof symbol === "string" ? symbol : symbol.name,
    ...(locations ? { line: symbol.line, col: symbol.col, pos: symbol.pos, namespace: symbol.namespace } : {}),
  })))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const before = read("before.json");
const pinned = read("../knip-scoped-cleanup-20261016/after.json");
assert.ok(same(inventory(before, true), inventory(pinned, true)), "Baseline differs from pinned findings/locations");
const base = inventory(before);
const after = inventory(read("after.json"));
const probe = inventory(read("after-probe.json"));
const difference = (a, b) => a.filter(x => !b.some(y => same(x, y)));
const counts = list => Object.fromEntries(categories.map(kind => [kind, list.filter(x => x.kind === kind).length]));
const removed = difference(base, after);
const added = difference(after, base);
assert.equal(removed.length, 22);
assert.deepEqual(added, []);
assert.equal(after.length, 42);
const result = {
  base: "b500565363af0fc566decb7327c717da61cfabd7",
  runtime: { bun: "1.4.0", node: "24.22.0", knip: "6.41.0" },
  exactPinnedBaselineIncludingLocations: true,
  before: counts(base), after: counts(after), removed, added,
  deferredRoutes: base.filter(x => x.file === "src/routes/appRoutes.lazy.ts"),
  routeRemovalProbe: { counts: counts(probe), added: difference(probe, base) },
};
writeFileSync(new URL("comparison.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log("PASS: pinned baseline exact; 64 → 42 findings, 22 removed, 0 added; 2 route warnings deferred.");
