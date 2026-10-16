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
assert.ok(same(inventory(before, true), inventory(read("../after.json"), true)), "Baseline differs from PR 383 inventory");
const base = inventory(before);
const after = inventory(read("after.json"));
const difference = (a, b) => a.filter(x => !b.some(y => same(x, y)));
const counts = list => Object.fromEntries(categories.map(kind => [kind, list.filter(x => x.kind === kind).length]));
const removed = difference(base, after);
const added = difference(after, base);
assert.deepEqual(removed.map(x => [x.file, x.name]), [
  ["src/routes/appRoutes.lazy.ts", "CrmProspectos"],
  ["src/routes/appRoutes.lazy.ts", "Leads"],
]);
assert.deepEqual(added, []);
assert.equal(after.length, 40);
const result = {
  base: "c1d86c349b80faa7489d250440924ea77848c57d",
  runtime: { bun: "1.4.0", node: "24.22.0", knip: "6.41.0" },
  exactPriorBaselineIncludingLocations: true,
  before: counts(base), after: counts(after), removed, added,
};
writeFileSync(new URL("comparison.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log("PASS: baseline exact; 42 → 40 findings, both route warnings removed, 0 added.");
