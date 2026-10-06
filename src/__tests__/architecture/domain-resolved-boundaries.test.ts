import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { walk, relPath } from "../../../scripts/lib/walk";

/** Resolve relative imports too: import type still determines contract ownership. */
describe("pure domain owns its contracts", () => {
  it("does not import services, hooks, components or routes", () => {
    const root = process.cwd();
    const violations: string[] = [];
    for (const file of walk(join(root, "src/features"))) {
      const relative = relPath(root, file);
      if (!/^src\/features\/[^/]+\/domain\//.test(relative) || /(__tests__|\.test\.|\.spec\.)/.test(relative)) continue;
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        const spec = statement.moduleSpecifier;
        if (!spec || !ts.isStringLiteral(spec)) continue;
        const target = spec.text.startsWith("@/") ? resolve(root, "src", spec.text.slice(2))
          : spec.text.startsWith(".") ? resolve(dirname(file), spec.text) : spec.text;
        if (/\/(services|hooks|components|routes)(\/|$)/.test(target)) violations.push(`${relative} -> ${spec.text}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
