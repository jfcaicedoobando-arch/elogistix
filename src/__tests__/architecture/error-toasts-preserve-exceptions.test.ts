// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** Inspect exception handlers, not local form validation without an exception. */
function violations(source: string, file: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  function inFailureHandler(node: ts.Node): boolean {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCatchClause(parent)) return true;
      if ((ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) &&
        ts.isPropertyAssignment(parent.parent) && parent.parent.name.getText(ast) === "onError") return true;
    }
    return false;
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "notifyError" && inFailureHandler(node)) {
      const options = node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const properties = options.properties;
        const hasError = properties.some((p) => p.name?.getText(ast) === "error" || ts.isSpreadAssignment(p));
        const forcesValidation = properties.some((p) => ts.isPropertyAssignment(p) &&
          p.name.getText(ast) === "errorCode" && p.initializer.getText(ast) === "ERROR_CODES.VALIDATION_FAILED");
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
        if (!hasError) problems.push(`${file}:${line}: conserva la excepción en error`);
        if (forcesValidation) problems.push(`${file}:${line}: no reclasifiques toda excepción como validación`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return problems;
}

describe("Error toasts conservan la excepción capturada", () => {
  it("detecta catch sin excepción y onError con clasificación incorrecta", () => {
    expect(violations('try {} catch { notifyError(undefined, {title: "Falló"}); }', "mock.ts")).toHaveLength(1);
    expect(violations('const m = {onError: (err) => notifyError(undefined, {error: err, errorCode: ERROR_CODES.VALIDATION_FAILED})};', "mock.ts")).toHaveLength(1);
    expect(violations('try {} catch (err) { notifyError(undefined, {error: err}); }', "mock.ts")).toEqual([]);
    expect(violations('const m = {onError: (err) => notifyError(undefined, {error: err})};', "mock.ts")).toEqual([]);
  });

  it("permite validaciones locales explícitas sin excepción", () => {
    expect(violations('if (!id) notifyError(undefined, {errorCode: ERROR_CODES.VALIDATION_FAILED});', "mock.ts")).toEqual([]);
  });

  it("ningún emisor pierde la excepción o impone VALIDATION_FAILED en catch/onError", async () => {
    const root = path.resolve(__dirname, "../../..");
    const files = await fg("src/**/*.{ts,tsx}", {
      cwd: root, ignore: ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
    });
    const problems = files.flatMap((file) => {
      const source = readFileSync(path.join(root, file), "utf8");
      return source.includes("notifyError") ? violations(source, file) : [];
    });
    expect(problems).toEqual([]);
  });
});
