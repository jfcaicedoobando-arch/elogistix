import ts from "typescript";
import { DYNAMIC_TABLE } from "./model.ts";

export function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
    node = node.expression;
  }
  return node;
}
export function method(node: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) return node.argumentExpression.text;
  return undefined;
}
export function receiver(node: ts.Expression): ts.Expression | undefined {
  return ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ? node.expression : undefined;
}
export function tables(node: ts.Expression | undefined): string[] {
  if (!node) return [DYNAMIC_TABLE];
  node = unwrap(node);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...new Set([...tables(node.whenTrue), ...tables(node.whenFalse)])];
  return [DYNAMIC_TABLE];
}
export function isStorage(node: ts.Expression): boolean {
  node = unwrap(node);
  const base = receiver(node);
  return method(node) === "storage" || (base !== undefined && isStorage(base));
}
export function chain(node: ts.Expression): ts.Expression {
  for (;;) {
    const parent = node.parent;
    if (parent && ts.isExpression(parent) && unwrap(parent) === node) node = parent;
    else if (parent && receiver(parent as ts.Expression) === node &&
      parent.parent && ts.isCallExpression(parent.parent) && parent.parent.expression === parent) node = parent.parent;
    else return node;
  }
}
export function hasException(node: ts.Expression, source: ts.SourceFile): boolean {
  const end = chain(node);
  const text = source.text.slice(node.getStart(source), end.end);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  let token: ts.SyntaxKind;
  while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if ((token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) &&
      /\bSOFT-DELETE-OK:\s*\S/.test(scanner.getTokenText().slice(2, token === ts.SyntaxKind.MultiLineCommentTrivia ? -2 : undefined))) return true;
  }
  // Una excepción al final de esta misma cadena, nunca de la siguiente consulta.
  const trailing = source.text.slice(end.end).split(/\r?\n/, 1)[0];
  return /^\s*;?\s*\/\/\s*SOFT-DELETE-OK:\s*\S/.test(trailing);
}
