import ts from "typescript";
import type { Context, Hallazgo } from "./model.ts";
import { chain, method } from "./syntax.ts";
import { consume, finish } from "./flow.ts";
import { createEvaluator } from "./expressions.ts";
import { createExecutor } from "./statements.ts";

/**
 * Intraprocedural: cada origen sigue aliases locales y todas las ramas.
 * Await/return/escape se comprueban antes de filtros posteriores. No se infieren
 * contratos de helpers, parámetros de tabla ni mapas dinámicos; se reportan
 * para revisión cuando no hay protección explícita. Capturas y control de flujo
 * no modelado son conservadores: pueden exigir revisión, nunca una allowlist
 * automática. No sustituye pruebas de servicio, RLS ni análisis interprocedural.
 */
export function analizarContenido(contenido: string, archivo = "fixture.ts"): Hallazgo[] {
  const source = ts.createSourceFile(archivo, contenido, ts.ScriptTarget.Latest, true,
    archivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const context: Context = { source, origins: new Map(), functions: [] };
  const fromCalls: ts.CallExpression[] = [];
  function collect(node: ts.Node): void {
    if (ts.isCallExpression(node) && method(node.expression) === "from") fromCalls.push(node);
    if (ts.isFunctionLike(node) && "body" in node && node.body) context.functions.push(node as ts.FunctionLikeDeclaration);
    ts.forEachChild(node, collect);
  }
  collect(source);
  const evaluate = createEvaluator(context), { block } = createExecutor(evaluate);
  finish(block(source.statements, new Map()));
  for (const fn of context.functions) {
    if (!fn.body) continue;
    if (ts.isBlock(fn.body)) finish(block(fn.body.statements, new Map()));
    else consume(evaluate(fn.body, new Map()));
  }
  // No omitir un origen en sintaxis no modelada: comprobar su cadena propia.
  for (const call of fromCalls) if (!context.origins.has(call)) consume(evaluate(chain(call), new Map()));
  return [...context.origins.values()].filter(origin => origin.read && origin.unsafe && !origin.excepted)
    .flatMap(origin => origin.tables.map(tabla => ({
      archivo, tabla,
      linea: source.getLineAndCharacterOfPosition(origin.node.expression.getEnd() - 4).line + 1,
      tipo: origin.single ? "puntual" as const : "listado" as const,
    }))).sort((a, b) => `${a.archivo}${a.tabla}`.localeCompare(`${b.archivo}${b.tabla}`) || a.linea - b.linea);
}

/** Compatibilidad del API de pruebas: sólo la cadena, nunca texto vecino. */
export function ventanaConsulta(contenido: string, indice: number): string {
  const source = ts.createSourceFile("query.ts", contenido, ts.ScriptTarget.Latest, true);
  let found = "";
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && method(node.expression) === "from" && node.getStart(source) <= indice && indice < node.end) found = chain(node).getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}
export function lecturaProtegida(consulta: string): boolean {
  if (!consulta.trim()) return false;
  return analizarContenido(`async function prueba() { return ${consulta.replace(/;\s*$/, "")}; }`).length === 0 && /\.select\s*\(/.test(consulta);
}
