import { describe, expect, it } from "vitest";
import { extractDumpFunction } from "../extractDumpFunction";

const name = "public.seed_demo_organization_guarded";
const body = "BEGIN\n  RETURN true;\nEND;\n";
const header = (qualifiedName = name) => `CREATE FUNCTION ${qualifiedName}() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET row_security TO 'off'
    AS `;
const definition = (tag: string, qualifiedName = name, value = body) => `${header(qualifiedName)}${tag}\n${value}${tag};\n`;
const nextFunction = definition("$$", "public.seed_presupuesto_categorias", "BEGIN\n  RETURN false;\nEND;\n");

describe("normalized dump function extraction", () => {
  it.each(["$$", "$_$", "$function$", "$Tag_1$"])("matches %s without reading the next function", (tag) => {
    expect(extractDumpFunction(definition(tag) + nextFunction, name))
      .toEqual({ header: header(), body });
  });

  it("preserves differently tagged nested dollar quotes", () => {
    const nested = "BEGIN\n  v_graph_sql := $graph$SELECT 1$graph$;\n  RETURN true;\nEND;\n";
    expect(extractDumpFunction(definition("$_$", name, nested) + nextFunction, name).body).toBe(nested);
  });

  it("requires an anchored declaration with the exact schema and name", () => {
    for (const sql of ["", nextFunction, definition("$$", `${name}_other`),
      definition("$$", "private.seed_demo_organization_guarded"), `-- ${definition("$$")}`]) {
      expect(() => extractDumpFunction(sql, name)).toThrow("found 0");
    }
  });

  it("rejects multiple declarations, including overloads and replacements", () => {
    for (const duplicate of [definition("$_$"), definition("$_$").replace("()", "(p_skip_ms bigint)"),
      definition("$_$").replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION")]) {
      expect(() => extractDumpFunction(definition("$$") + duplicate, name)).toThrow("found 2");
    }
  });

  it("does not borrow a missing AS or opening delimiter from the next function", () => {
    for (const incomplete of [header().replace(/ {4}AS $/, ""), `${header()}\n${body}`]) {
      expect(() => extractDumpFunction(incomplete + nextFunction, name)).toThrow("Missing or mismatched");
    }
  });

  it.each(["$$", "$_$", "$function$"])("rejects an unclosed %s body even when the next function uses that tag", (tag) => {
    expect(() => extractDumpFunction(`${header()}${tag}\n${body}` + definition(tag, "public.next_function"), name))
      .toThrow("Missing or mismatched");
  });

  it("also stops before a quoted or noncanonical next function header", () => {
    for (const next of [definition("$_$", 'public."next_function"'),
      definition("$_$", "public.next_function").replace("CREATE FUNCTION", "create function")]) {
      expect(() => extractDumpFunction(`${header()}$_$\n${body}` + next, name))
        .toThrow("Missing or mismatched");
    }
  });

  it.each([["$_$", "$$"], ["$function$", "$_$"], ["$Tag$", "$tag$"]])("rejects opening %s with closing %s", (open, close) => {
      expect(() => extractDumpFunction(`${header()}${open}\n${body}${close};\n` + nextFunction, name))
        .toThrow("Missing or mismatched");
    });

  it("cannot satisfy a header assertion using configuration from the next function", () => {
    const missingSetting = definition("$_$").replace("    SET row_security TO 'off'\n", "");
    expect(extractDumpFunction(missingSetting + nextFunction, name).header)
      .not.toContain("SET row_security TO 'off'");
  });
});
