// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditarReplayMirror, huellaDefinicion, indexarMigraciones, leerBaseline,
  type EntradaBaseline } from "../../../scripts/lib/replayMirror";
import { extraerFunciones } from "../../../scripts/lib/replayMirrorFunctions";
import { normalizeSql } from "../../../scripts/lib/replayMirrorSql";

const declaration = (body = "SELECT 1;", args = "p_id uuid", tag = "$$") =>
  `CREATE OR REPLACE FUNCTION public.demo(${args}) RETURNS integer LANGUAGE sql AS ${tag}\n${body}\n${tag};`;
const MIRROR = "supabase/schema/demo.sql";
const MIGRATION = "20261001000000_demo.sql";
const original = declaration();
const divergent = declaration("SELECT 2;");
const definition = (sql: string) => extraerFunciones(sql)[0];
const entry: EntradaBaseline = {
  espejo: MIRROR, funcion: "demo", firma: "demo(uuid)", migracion_vigente: MIGRATION,
  sha256_espejo: huellaDefinicion(definition(original)),
  sha256_migracion: huellaDefinicion(definition(divergent)),
  responsable: "Mantenedores SQL", justificacion: "Divergencia histórica revisada",
  condicion_retiro: "Retirar cuando el espejo coincida con el replay verificado",
};
const audit = (mirror = original, migration = divergent, baseline = [entry]) =>
  auditarReplayMirror(new Map([[MIRROR, mirror]]), new Map([[MIGRATION, migration]]), baseline);

describe("ARQ04: normalización SQL conservadora", () => {
  it("normaliza indentación, comentarios exteriores y sólo el dollar delimiter del cuerpo", () => {
    expect(definition(declaration("SELECT 1; -- nota", "p_id uuid", "$function$")).cuerpo)
      .toBe(definition(original).cuerpo);
    expect(normalizeSql("SELECT  /* exterior /* anidado */ fin */  1;")).toBe("SELECT 1;");
  });

  it.each([
    ["SELECT '-- antes';", "SELECT '-- después';"],
    ["SELECT '/* antes */';", "SELECT '/* después */';"],
    ["SELECT 'a  b';", "SELECT 'a b';"],
    ['SELECT "a  b";', 'SELECT "a b";'],
    ["SELECT 'a''-- b';", "SELECT 'a''-- c';"],
    [String.raw`SELECT E'a\'-- b';`, String.raw`SELECT E'a\'-- c';`],
    ["SELECT $inner$-- a  b$inner$;", "SELECT $inner$-- a b$inner$;"],
    ["SELECT '$function$';", "SELECT '$other$';"],
    ["SELECT 'a'\n'b';", "SELECT 'a' 'b';"],
  ])("no esconde cambios dentro de literales: %s", (before, after) => {
    expect(definition(declaration(before)).cuerpo).not.toBe(definition(declaration(after)).cuerpo);
  });

  it("no reemplaza ocurrencias del delimitador dentro de una cadena", () => {
    const body = "SELECT '$function$', $inner$-- $$ literal$inner$;";
    expect(definition(declaration(body, "", "$outer$")).cuerpo)
      .toBe(definition(declaration(body, "", "$renamed$")).cuerpo);
  });

  it("conserva el cuerpo exacto de lenguajes que no son SQL/PLpgSQL", () => {
    const before = declaration("return 'a  b'").replace("LANGUAGE sql", "LANGUAGE plpython3u");
    expect(definition(before).cuerpo).not.toBe(definition(before.replace("a  b", "a b")).cuerpo);
  });

  it("incluye opciones posteriores al cuerpo y excluye GRANT/REVOKE", () => {
    const before = original.replace(" LANGUAGE sql", "").replace(/;$/, " LANGUAGE sql SECURITY INVOKER;");
    expect(definition(before).cuerpo).not.toBe(definition(before.replace("INVOKER", "DEFINER")).cuerpo);
    expect(definition(`${before} GRANT EXECUTE ON FUNCTION public.demo(uuid) TO authenticated;`).cuerpo)
      .toBe(definition(before).cuerpo);
  });

  it("ignora sólo el terminador y metadatos conocidos de los espejos", () => {
    const mirror = original.replace(/;$/, "\n name:demo schema:public;");
    expect(definition(mirror).cuerpo).toBe(definition(original).cuerpo);
    expect(definition(original.replace(/;$/, " SECURITY DEFINER;")).cuerpo).not.toBe(definition(original).cuerpo);
  });

  it("no inventa funciones a partir de comentarios, literales o SQL dinámico", () => {
    const sql = `-- ${original.replace(/\n/g, " ")}\n/* ${original} */\nDO $block$ BEGIN EXECUTE '${original}'; END; $block$;`;
    expect(extraerFunciones(sql)).toEqual([]);
  });

  it.each(["SELECT 'sin cierre", "/* sin cierre", "DO $body$ sin cierre"])("rechaza SQL incompleto: %s", (sql) => {
    expect(() => extraerFunciones(sql)).toThrow(/sin cierre/);
  });
});

describe("ARQ04: identidad completa y migración efectiva", () => {
  it("mantiene cada overload aunque otra firma tenga una migración posterior", () => {
    const text = declaration("SELECT 3;", "p_id text");
    const migrations = new Map([[MIGRATION, original], ["20261002000000_text.sql", text]]);
    const result = auditarReplayMirror(new Map([[MIRROR, original + text]]), migrations, []);
    expect(result).toEqual({ violaciones: [], verificados: 2, tolerados: 0 });
  });

  it("usa la última definición dentro de una misma migración", () => {
    const indexed = indexarMigraciones(new Map([[MIGRATION, original + divergent]]));
    expect(indexed.get("demo(uuid)")?.definicion.cuerpo).toBe(definition(divergent).cuerpo);
  });

  it("identifica tipos sin confundir nombres, defaults con comas o argumentos OUT", () => {
    expect(definition(declaration("SELECT 1;", "p_id uuid DEFAULT 'a,b', OUT result integer")).firma).toBe("demo(uuid)");
    expect(definition(declaration("SELECT 1;", "IN p_id integer, INOUT total numeric(12,2)")).firma).toBe("demo(int,numeric)");
    expect(definition(declaration("SELECT 1;", "double precision, timestamp without time zone")).firma).toBe("demo(float8,timestamp)");
    expect(definition(declaration("SELECT 1;", "p_id public.demo_type[], VARIADIC values text[]")).firma).toBe("demo(public.demo_type[],text[])");
  });

  it("un default modificado sigue perteneciendo a la misma firma y falla", () => {
    const previous = declaration("SELECT 1;", "p_id uuid DEFAULT NULL");
    const changed = declaration("SELECT 1;", "p_id uuid DEFAULT gen_random_uuid()");
    const result = auditarReplayMirror(new Map([[MIRROR, previous]]), new Map([
      [MIGRATION, previous], ["20261002000000_new.sql", changed],
    ]), []);
    expect(result.violaciones).toHaveLength(1);
    expect(result.violaciones[0]).toContain("20261002000000_new.sql");
  });
});

describe("ARQ04: excepciones exactas y cerradas", () => {
  it("tolera únicamente la pareja revisada", () => {
    expect(audit()).toEqual({ violaciones: [], verificados: 0, tolerados: 1 });
  });
  it.each(["espejo", "migración"])("rechaza una mutación adicional del %s", (side) => {
    const result = side === "espejo" ? audit(declaration("SELECT 4;")) : audit(original, declaration("SELECT 4;"));
    expect(result.violaciones).toHaveLength(1);
    expect(result.violaciones[0]).toContain(`huella ${side === "espejo" ? "del espejo" : "de la migración"}`);
  });
  it("rechaza cambiar de migración aunque el cuerpo siga igual", () => {
    const migrations = new Map([[MIGRATION, divergent], ["20261002000000_new.sql", divergent]]);
    expect(auditarReplayMirror(new Map([[MIRROR, original]]), migrations, [entry]).violaciones[0])
      .toContain("migración vigente: 20261002000000_new.sql");
  });
  it("no permite hashes válidos si el timestamp registrado está obsoleto", () => {
    expect(audit(original, divergent, [{ ...entry, migracion_vigente: "20260701000000_old.sql" }]).violaciones[0])
      .toContain("excepción modificada");
  });
  it("rechaza entradas resueltas, inexistentes, firmas duplicadas y espejos huérfanos", () => {
    expect(audit(original, original).violaciones[0]).toContain("entrada muerta");
    expect(audit("", divergent).violaciones).toHaveLength(2);
    expect(audit(original + original).violaciones[0]).toContain("firma duplicada");
    expect(audit(declaration("SELECT 1;", "p_id bigint")).violaciones[0]).toContain("espejo huérfano");
  });
  it.each(["responsable", "justificacion", "condicion_retiro", "firma", "sha256_espejo", "sha256_migracion"])("requiere %s en la baseline", (field) => {
    expect(() => leerBaseline({ entradas: [{ ...entry, [field]: "" }] })).toThrow("Baseline inválido");
  });
  it("rechaza hashes malformados y entradas duplicadas", () => {
    expect(() => leerBaseline({ entradas: [{ ...entry, sha256_espejo: "123" }] })).toThrow("SHA-256");
    expect(() => leerBaseline({ entradas: [entry, entry] })).toThrow("duplicado");
  });
});

describe("ARQ04: baseline real del repositorio", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const baseline = leerBaseline(JSON.parse(fs.readFileSync(path.join(root, "scripts/audit-replay-mirror-baseline.json"), "utf8")));
  const mirrorFiles = [...new Set(baseline.map((e) => e.espejo))];
  const mirrors = new Map(mirrorFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));
  const migrations = new Map(fs.readdirSync(path.join(root, "supabase/migrations")).filter((file) => file.endsWith(".sql"))
    .map((file) => [file, fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8")]));

  it("fija las migraciones realmente vigentes y ambas huellas", () => {
    const result = auditarReplayMirror(mirrors, migrations, baseline);
    expect(result.violaciones).toEqual([]);
    expect(result.tolerados).toBe(baseline.length);
  });

  it.each(baseline)("rechaza mutaciones de ambos lados de $firma", (exception) => {
    // Mutation is in memory only: no migration, mirror or DB is ever modified.
    const marker = exception.funcion === "auditoria_embarques_org"
      ? "v_fecha_corte_facturacion constant date := DATE '2026-04-01'"
      : "'total_hallazgos', COUNT(*)";
    const mutate = (sql: string) => {
      expect(sql).toContain(marker);
      return sql.replace(marker, exception.funcion === "auditoria_embarques_org"
        ? "v_fecha_corte_facturacion constant date := DATE '2026-05-01'"
        : "'total_hallazgos', COUNT(h)");
    };
    const changedMirror = new Map(mirrors);
    changedMirror.set(exception.espejo, mutate(mirrors.get(exception.espejo)!));
    expect(auditarReplayMirror(changedMirror, migrations, baseline).violaciones)
      .toContain(`${exception.espejo}::${exception.firma}: excepción modificada (huella del espejo); requiere revisión, no ampliar baseline`);
    const changedMigration = new Map(migrations);
    changedMigration.set(exception.migracion_vigente, mutate(migrations.get(exception.migracion_vigente)!));
    expect(auditarReplayMirror(mirrors, changedMigration, baseline).violaciones)
      .toContain(`${exception.espejo}::${exception.firma}: excepción modificada (huella de la migración); requiere revisión, no ampliar baseline`);
  });

  it("retira las dos falsas divergencias de formato sin exceptuarlas otra vez", () => {
    const recalcular = "supabase/schema/facturacion/recalcular_estado_factura.sql";
    const mirror = fs.readFileSync(path.join(root, recalcular), "utf8");
    expect(auditarReplayMirror(new Map([[recalcular, mirror]]), migrations, []).violaciones).toEqual([]);
    expect(baseline.some((e) => ["recalcular_estado_factura", "_audit_embarques_umbrales"].includes(e.funcion))).toBe(false);
  });
});
