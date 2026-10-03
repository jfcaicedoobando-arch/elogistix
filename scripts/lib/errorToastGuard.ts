import ts from "typescript";

/** Import-aware guard; catches aliases and conditional destructive variants. */
export function errorToastViolations(source: string): string[] {
  const file = ts.createSourceFile("audit.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: string[] = [];
  function inspect(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "sonner") {
      violations.push("Importación directa de Sonner");
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "toast") {
      const props = node.arguments[0];
      if (props && ts.isObjectLiteralExpression(props) && props.properties.some(destructiveVariant)) {
        violations.push("Toast legacy destructivo");
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(file);
  return violations;
}

function destructiveVariant(node: ts.ObjectLiteralElementLike): boolean {
  if (!ts.isPropertyAssignment(node) || node.name.getText().replace(/["']/g, "") !== "variant") return false;
  return containsDestructive(node.initializer);
}
function containsDestructive(node: ts.Node): boolean {
  if (ts.isStringLiteral(node) && node.text === "destructive") return true;
  return ts.forEachChild(node, containsDestructive) ?? false;
}
