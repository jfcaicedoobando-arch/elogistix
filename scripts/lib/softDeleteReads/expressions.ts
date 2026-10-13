import ts from "typescript";
import { BUILDER_METHODS, DYNAMIC_TABLE, TABLE_SET, WRITES, type Context, type Env, type Query, type Evaluate } from "./model.ts";
import { hasException, isStorage, method, receiver, tables, unwrap } from "./syntax.ts";
import { clone, consume, merge, replace } from "./flow.ts";
import { captures, namedFunctions } from "./captures.ts";

function invalidate(target: ts.Expression, env: Env): void {
  target = unwrap(target);
  if (ts.isIdentifier(target)) env.delete(target.text);
  else if (ts.isArrayLiteralExpression(target)) for (const item of target.elements) {
    if (ts.isSpreadElement(item)) invalidate(item.expression, env);
    else if (!ts.isOmittedExpression(item)) invalidate(item, env);
  }
  else if (ts.isObjectLiteralExpression(target)) for (const item of target.properties) {
    if (ts.isShorthandPropertyAssignment(item)) env.delete(item.name.text);
    else if (ts.isPropertyAssignment(item)) invalidate(item.initializer, env);
    else if (ts.isSpreadAssignment(item)) invalidate(item.expression, env);
  }
}
function children(node: ts.Node, env: Env, evaluate: Evaluate): void {
  ts.forEachChild(node, child => {
    if (ts.isFunctionLike(child)) { captures(child as ts.FunctionLikeDeclaration, env); return; }
    if (ts.isPropertyAssignment(child)) consume(evaluate(child.initializer, env));
    else if (ts.isShorthandPropertyAssignment(child)) consume(evaluate(child.name, env));
    else if (ts.isExpression(child)) consume(evaluate(child, env));
    else children(child, env, evaluate);
  });
}
function nullFilter(node: ts.CallExpression): boolean {
  const column = node.arguments[0] && unwrap(node.arguments[0]);
  const value = node.arguments[1] && unwrap(node.arguments[1]);
  return !!column && ts.isStringLiteralLike(column) && column.text === "deleted_at" &&
    value?.kind === ts.SyntaxKind.NullKeyword && !node.questionDotToken &&
    !(ts.isPropertyAccessExpression(node.expression) && node.expression.questionDotToken);
}
function singleRead(name: string, node: ts.CallExpression): boolean {
  const column = node.arguments[0] && unwrap(node.arguments[0]);
  return name === "single" || name === "maybeSingle" ||
    (name === "eq" && !!column && ts.isStringLiteralLike(column) && column.text === "id");
}
function derive(queries: Query[], name: string, node: ts.CallExpression): Query[] {
  // PostgrestQueryBuilder.select/write crea un FilterBuilder independiente.
  // Los filtros mutan ese derivado, nunca el .from reutilizable original.
  const derived = queries.map(query => query.mode === "unknown" && (name === "select" || WRITES.has(name)) ? { ...query } : query);
  for (const query of derived) {
    if (WRITES.has(name) && query.mode === "unknown") query.mode = "write";
    if (name === "select" && query.mode !== "write") { query.mode = "read"; query.origin.read = true; }
    if (name === "is" && nullFilter(node)) query.protected = true;
    if (singleRead(name, node)) query.origin.single = true;
  }
  return derived;
}
function from(node: ts.CallExpression, context: Context): Query[] {
  const targets = tables(node.arguments[0]).filter(table => TABLE_SET.has(table) || table === DYNAMIC_TABLE);
  if (!targets.length) return [];
  if (!context.origins.has(node)) context.origins.set(node, {
    node, tables: targets, read: false, unsafe: false, single: false, excepted: hasException(node, context.source),
  });
  return [{ origin: context.origins.get(node)!, protected: false, mode: "unknown" }];
}
function captureCallee(node: ts.Expression, env: Env, context: Context): void {
  node = unwrap(node);
  if (ts.isIdentifier(node)) for (const fn of namedFunctions(context.functions, node.text)) captures(fn, env);
  else if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) captures(node, env);
}
const SHORT_CIRCUIT = new Set([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]);
function binary(node: ts.BinaryExpression, env: Env, evaluate: Evaluate): Query[] | undefined {
  if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const result = evaluate(node.right, env);
    if (ts.isIdentifier(node.left)) env.set(node.left.text, result);
    else { consume(result); invalidate(node.left, env); }
    return result;
  }
  if (!SHORT_CIRCUIT.has(node.operatorToken.kind)) return undefined;
  const left = evaluate(node.left, env), skipped = clone(env), taken = clone(env);
  const right = evaluate(node.right, taken);
  replace(env, merge(skipped, taken)!);
  return [...left, ...right];
}
export function createEvaluator(context: Context): Evaluate {
  function call(node: ts.CallExpression, env: Env): Query[] {
    const name = method(node.expression), base = receiver(node.expression);
    if (name === "from" && base && !isStorage(base) && base.getText(context.source) !== "Array") return from(node, context);
    if (!base) captureCallee(node.expression, env, context);
    const queries = base ? evaluate(base, env) : [];
    for (const argument of node.arguments) consume(evaluate(argument, env));
    if (name && BUILDER_METHODS.has(name) && queries.length) return derive(queries, name, node);
    consume(queries);
    return [];
  }
  function evaluate(raw: ts.Expression, env: Env): Query[] {
    const node = unwrap(raw);
    if (ts.isIdentifier(node)) { captureCallee(node, env, context); return env.get(node.text) ?? []; }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) { captures(node, env); return []; }
    if (ts.isAwaitExpression(node)) { consume(evaluate(node.expression, env)); return []; }
    if (ts.isConditionalExpression(node)) {
      consume(evaluate(node.condition, env));
      const yes = clone(env), no = clone(env);
      const result = [...evaluate(node.whenTrue, yes), ...evaluate(node.whenFalse, no)];
      replace(env, merge(yes, no)!);
      return result;
    }
    if (ts.isBinaryExpression(node)) {
      const result = binary(node, env, evaluate);
      if (result !== undefined) return result;
    }
    if (ts.isCallExpression(node)) return call(node, env);
    // Objetos/arrays/operadores pueden sacar un builder de su ámbito. No se
    // supone que un helper ajeno añadirá el filtro antes de ejecutar la consulta.
    children(node, env, evaluate);
    return [];
  }
  return evaluate;
}
