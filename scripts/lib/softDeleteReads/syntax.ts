import ts from "typescript";
import { DYNAMIC_TABLE } from "./model.ts";

function wrapped(node: ts.Expression): ts.Expression | undefined {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) ? node.expression : undefined;
}
export function unwrap(node: ts.Expression): ts.Expression {
  while (wrapped(node)) node = wrapped(node)!;
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
    if (parent && ts.isExpression(parent) && wrapped(parent) === node) node = parent;
    else if (parent && receiver(parent as ts.Expression) === node &&
      parent.parent && ts.isCallExpression(parent.parent) && parent.parent.expression === parent) node = parent.parent;
    else return node;
  }
}
function delimitedRange(node: ts.Node, source: ts.SourceFile, openKind: ts.SyntaxKind, closeKind: ts.SyntaxKind): ts.TextRange[] {
  const tokens = node.getChildren(source);
  const open = tokens.find(token => token.kind === openKind);
  const close = tokens.find(token => token.kind === closeKind);
  return open && close ? [{ pos: open.end, end: close.getStart(source) }] : [];
}
/** Sólo trivia propia del receptor: argumentos, claves calculadas y tipos no autorizan excepciones. */
function excludedRanges(node: ts.Expression, source: ts.SourceFile): ts.TextRange[] {
  const ranges: ts.TextRange[] = [];
  let current: ts.Expression | undefined = node;
  while (current) {
    if (ts.isCallExpression(current)) {
      ranges.push(...delimitedRange(current, source, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.CloseParenToken));
      if (current.typeArguments?.length) ranges.push(...delimitedRange(current, source, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken));
      current = current.expression;
    } else if (ts.isElementAccessExpression(current)) {
      ranges.push(...delimitedRange(current, source, ts.SyntaxKind.OpenBracketToken, ts.SyntaxKind.CloseBracketToken));
      current = current.expression;
    } else if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
      const keyword = current.getChildren(source).find(token => token.kind === ts.SyntaxKind.AsKeyword || token.kind === ts.SyntaxKind.SatisfiesKeyword)!;
      ranges.push({ pos: keyword.getStart(source), end: current.end });
      current = current.expression;
    } else if (ts.isTypeAssertionExpression(current)) {
      ranges.push({ pos: current.getStart(source), end: current.expression.getStart(source) });
      current = current.expression;
    } else current = wrapped(current) ?? receiver(current);
  }
  return ranges;
}
function maskExcluded(text: string, start: number, ranges: ts.TextRange[]): string {
  const chars = text.split("");
  for (const range of ranges) {
    for (let i = Math.max(0, range.pos - start); i < Math.min(chars.length, range.end - start); i++) {
      if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
    }
  }
  return chars.join("");
}
export function hasException(node: ts.Expression, source: ts.SourceFile): boolean {
  const end = chain(node), excluded = excludedRanges(end, source);
  // El cuerpo o los argumentos del factory del cliente tampoco son de este origen.
  const start = ts.isCallExpression(node) ? receiver(node.expression)?.end ?? node.getStart(source) : node.getStart(source);
  // Enmascarar antes del scanner evita que templates/regex de argumentos cambien su estado léxico.
  const text = maskExcluded(source.text.slice(start, end.end), start, excluded);
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
