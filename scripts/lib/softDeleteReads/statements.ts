import ts from "typescript";
import type { Env, Evaluate, Query } from "./model.ts";
import { clone, consume, finish, merge } from "./flow.ts";
import { captures } from "./captures.ts";
import { receiver } from "./syntax.ts";

function declarations(list: ts.VariableDeclarationList, env: Env, evaluate: Evaluate): void {
  for (const declaration of list.declarations) {
    const values = declaration.initializer ? evaluate(declaration.initializer, env) : [];
    if (ts.isIdentifier(declaration.name)) env.set(declaration.name.text, values);
    else consume(values);
  }
}
function expression(node: ts.ExpressionStatement, env: Env, evaluate: Evaluate): Env {
  const values = evaluate(node.expression, env);
  if (values.some(query => query.origin.node.getStart() >= node.getStart())) consume(values);
  // Extensiones standalone mutan el builder, pero no lo ejecutan.
  if (!ts.isBinaryExpression(node.expression) && !ts.isCallExpression(node.expression)) consume(values);
  else if (ts.isCallExpression(node.expression) && !receiver(node.expression.expression)) consume(values);
  return env;
}
function saveShadows(statement: ts.Statement, env: Env, shadowed: Map<string, Query[] | undefined>): void {
  if (!ts.isVariableStatement(statement)) return;
  for (const declaration of statement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && !shadowed.has(declaration.name.text)) shadowed.set(declaration.name.text, env.get(declaration.name.text));
  }
}
function restoreShadows(env: Env, shadowed: Map<string, Query[] | undefined>): void {
  for (const [name, old] of shadowed) {
    consume(env.get(name) ?? []);
    if (old) env.set(name, old); else env.delete(name);
  }
}
type Loop = ts.ForStatement | ts.ForInStatement | ts.ForOfStatement | ts.WhileStatement | ts.DoStatement;
function isLoop(node: ts.Statement): node is Loop {
  return ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node);
}
export function createExecutor(evaluate: Evaluate) {
  function block(statements: readonly ts.Statement[], env: Env, lexical = false): Env | null {
    const shadowed = new Map<string, Query[] | undefined>();
    let current: Env | null = env;
    for (const statement of statements) {
      if (!current) break;
      if (lexical) saveShadows(statement, current, shadowed);
      current = execute(statement, current);
    }
    if (current && lexical) restoreShadows(current, shadowed);
    return current;
  }
  function loop(node: Loop, env: Env): Env | null {
    // Puede no iterar, hacer break o lanzar. No se atribuye su filtro al exterior.
    const inside = clone(env);
    if ((ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) && node.initializer && ts.isVariableDeclarationList(node.initializer)) {
      declarations(node.initializer, inside, evaluate);
    }
    ts.forEachChild(node, child => { if (ts.isExpression(child)) consume(evaluate(child, inside)); });
    return merge(env, execute(node.statement, inside));
  }
  function tryStatement(node: ts.TryStatement, env: Env): Env | null {
    const tried = execute(node.tryBlock, clone(env));
    const caught = node.catchClause ? execute(node.catchClause.block, clone(env)) : clone(env);
    const joined = merge(tried, caught);
    return joined && node.finallyBlock ? execute(node.finallyBlock, joined) : joined;
  }
  function inspect(child: ts.Node, env: Env): void {
    if (ts.isFunctionLike(child)) captures(child as ts.FunctionLikeDeclaration, env);
    else if (ts.isStatement(child)) finish(execute(child, clone(env)));
    else if (ts.isExpression(child)) consume(evaluate(child, clone(env)));
    else ts.forEachChild(child, node => inspect(node, env));
  }
  function special(node: ts.Statement, env: Env): Env | null {
    if (ts.isIfStatement(node)) {
      consume(evaluate(node.expression, env));
      return merge(execute(node.thenStatement, clone(env)), node.elseStatement ? execute(node.elseStatement, clone(env)) : clone(env));
    }
    if (ts.isSwitchStatement(node)) {
      consume(evaluate(node.expression, env));
      for (const clause of node.caseBlock.clauses) finish(block(clause.statements, clone(env), true));
      return env;
    }
    if (isLoop(node)) return loop(node, env);
    if (ts.isTryStatement(node)) return tryStatement(node, env);
    // Formas no modeladas se inspeccionan sin propagar filtros al exterior.
    ts.forEachChild(node, child => inspect(child, env));
    return env;
  }
  function execute(node: ts.Statement, env: Env): Env | null {
    if (ts.isFunctionDeclaration(node)) { captures(node, env); return env; }
    if (ts.isBlock(node)) return block(node.statements, env, true);
    if (ts.isVariableStatement(node)) { declarations(node.declarationList, env, evaluate); return env; }
    if (ts.isExpressionStatement(node)) return expression(node, env, evaluate);
    if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) {
      if (node.expression) consume(evaluate(node.expression, env));
      return null;
    }
    return special(node, env);
  }
  return { block };
}
