import ts from "typescript";
import type { Env } from "./model.ts";
import { consume } from "./flow.ts";

function names(name: ts.BindingName): string[] {
  return ts.isIdentifier(name) ? [name.text]
    : name.elements.flatMap(item => ts.isOmittedExpression(item) ? [] : names(item.name));
}
function blockBindings(block: ts.Block, inherited: Set<string>): Set<string> {
  const bound = new Set(inherited);
  for (const statement of block.statements) {
    if (ts.isVariableStatement(statement)) {
      const declared = statement.declarationList.declarations.flatMap(declaration => names(declaration.name));
      for (const name of declared) bound.add(name);
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) bound.add(statement.name.text);
  }
  return bound;
}
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node);
}
/** Captura/escape conservador; no se infiere cuándo se ejecutará el callback. */
export function captures(fn: ts.FunctionLikeDeclaration, env: Env): void {
  function visit(node: ts.Node, inherited: Set<string>): void {
    let bound = inherited;
    if (node !== fn && ts.isFunctionLike(node)) {
      bound = new Set([...bound, ...node.parameters.flatMap(parameter => names(parameter.name))]);
    }
    if (ts.isBlock(node)) bound = blockBindings(node, bound);
    if (ts.isIdentifier(node) && !bound.has(node.text) && !isPropertyName(node)) consume(env.get(node.text) ?? []);
    ts.forEachChild(node, child => visit(child, bound));
  }
  const params = new Set(fn.parameters.flatMap(parameter => names(parameter.name)));
  if (fn.body) visit(fn.body, params);
}
export function namedFunctions(functions: ts.FunctionLikeDeclaration[], name: string): ts.FunctionLikeDeclaration[] {
  return functions.filter(fn => (fn.name && ts.isIdentifier(fn.name) && fn.name.text === name) ||
    (ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) && fn.parent.name.text === name));
}
