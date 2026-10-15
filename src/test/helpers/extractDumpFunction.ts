// Read one unquoted, schema-qualified function from normalized pg_dump SQL.
// This intentionally fails closed on unsupported headers or ambiguous names;
// it is a source-contract test helper, not a general-purpose SQL parser.
export function extractDumpFunction(sql: string, qualifiedName: string) {
  const declarations = [...sql.matchAll(/^[ \t]*CREATE(?:[ \t]+OR[ \t]+REPLACE)?[ \t]+FUNCTION[ \t]+([^\r\n(]+)\(/gmi)];
  const matching = declarations.filter((declaration) => declaration[1].trim() === qualifiedName);
  if (matching.length !== 1) {
    throw new Error(`Expected exactly one function ${qualifiedName}; found ${matching.length}`);
  }

  const declaration = matching[0];
  const next = declarations[declarations.indexOf(declaration) + 1];
  const statement = sql.slice(declaration.index, next?.index ?? sql.length);
  // Bound the search before any next function, then require the same dollar tag
  // at both ends. Nested dollar quotes may have a different tag (e.g. $graph$).
  const match = statement.match(/^([ \t]*CREATE(?: OR REPLACE)? FUNCTION [a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\([^$;]*?^[ \t]*AS[ \t]+)(\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)\r?\n([\s\S]*?)^\2;[ \t]*\r?$/m);
  if (!match) {
    throw new Error(`Missing or mismatched dollar-quoted body for ${qualifiedName}`);
  }
  return { header: match[1], body: match[3] };
}
