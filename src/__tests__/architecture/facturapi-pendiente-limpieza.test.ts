/**
 * P0 correctivo — los campos `*_pendiente_*` no deben sobrevivir ni a una
 * liberación de claim ni a una persistencia exitosa: un webhook tardío del
 * intento viejo podría localizar la fila recapturada y promover el CFDI
 * equivocado.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { preProcessFile } from "typescript";

const FN = "supabase/functions";
const MIGR = "supabase/migrations";

function leer(p: string): string {
  return readFileSync(p, "utf8");
}

function sqlConcatenado(): string {
  return readdirSync(MIGR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => leer(join(MIGR, f)))
    .join("\n");
}

describe("limpieza de timbrado pendiente", () => {
  it.each([
    ["factura", `${FN}/facturapi-emitir/persistencia.ts`, "facturapi_pendiente_id: null"],
    ["nota de crédito", `${FN}/facturapi-emitir-nota-credito/index.ts`, "facturapi_pendiente_id: null"],
    ["REP", `${FN}/facturapi-emitir-rep/persistir.ts`, "facturapi_rep_pendiente_id: null"],
  ])("la persistencia exitosa de %s limpia el intento pendiente", (_n, archivo, marca) => {
    const src = leer(archivo);
    expect(src).toContain(marca);
    expect(src).toContain(marca.replace("_id: null", "_at: null"));
  });

  it("la factura delega la limpieza en la persistencia Emitida protegida por CAS", () => {
    const emitir = leer(`${FN}/facturapi-emitir/emitir.ts`);
    expect(emitir).toMatch(/import\s*\{[^}]*\bpersistirFacturaTimbrada\b[^}]*\}\s*from\s*["']\.\/persistencia\.ts["']/);
    expect(emitir).toMatch(/const persistError = await persistirFacturaTimbrada\(input, resultado, respaldo\);\s*if \(persistError\) return persistError;/);
    const pendiente = emitir.indexOf("if (esTimbradoPendiente(invoice))");
    expect(pendiente).toBeGreaterThan(-1);
    expect(emitir.indexOf("await persistirFacturaTimbrada(input, resultado, respaldo)")).toBeGreaterThan(pendiente);

    const persistencia = leer(`${FN}/facturapi-emitir/persistencia.ts`);
    const actualizacion = persistencia.match(/\.from\("facturas"\)\s*\.update\(\{([\s\S]*?)\}\)\s*\.eq\("id", facturaId\)\s*\.eq\("facturapi_id", claim\.claimTag\)\s*\.select\("id"\)\s*\.maybeSingle\(\)/);
    expect(actualizacion).not.toBeNull();
    const patch = actualizacion?.[1] ?? "";
    expect(patch).toContain('estado: "Emitida"');
    expect(patch).toContain("facturapi_pendiente_id: null");
    expect(patch).toContain("facturapi_pendiente_at: null");
  });

  it("la liberación de claim de la nota de crédito limpia el pendiente", () => {
    const src = leer(`${FN}/facturapi-recuperar-claim/recuperar.nc.ts`);
    expect(src).toContain("facturapi_pendiente_id: null");
    expect(src).toContain("facturapi_pendiente_at: null");
  });

  it("las RPCs de liberación limpian las columnas pendientes", () => {
    const sql = sqlConcatenado();
    const ultimaFactura = sql.lastIndexOf("liberar_claim_facturapi_huerfano(p_factura_id");
    const ultimoRep = sql.lastIndexOf("liberar_claim_rep_huerfano(p_pago_id");
    expect(ultimaFactura).toBeGreaterThan(-1);
    expect(ultimoRep).toBeGreaterThan(-1);
    expect(sql.slice(ultimaFactura, ultimaFactura + 2500)).toContain("facturapi_pendiente_id = NULL");
    expect(sql.slice(ultimoRep, ultimoRep + 2500)).toContain("facturapi_rep_pendiente_id = NULL");
  });

  it("el webhook escribe con CAS sobre la columna de claim", () => {
    const proceso = leer(`${FN}/_shared/facturapi-webhook/procesamiento.ts`);
    const sql = leer("drizzle/migrations/0051_procesamiento_facturapi_webhook.sql");
    expect(proceso).toContain('rpc("finalizar_evento_facturapi_webhook"');
    expect(proceso).toContain("p_claim: resultado.claim");
    expect(sql).toContain("SELECT facturapi_id, updated_at INTO v_claim_actual");
    expect(sql).toContain("SELECT facturapi_rep_id, updated_at INTO v_claim_actual");
    const guard = sql.indexOf("v_claim_actual IS DISTINCT FROM p_claim");
    expect(guard).toBeGreaterThan(0);
    expect(sql.indexOf("public.cerrar_cancelacion_factura_facturapi(p_documento_id)")).toBeGreaterThan(guard);
    expect(sql.indexOf("UPDATE public.%I SET %s WHERE id = $2")).toBeGreaterThan(guard);
  });

  it.each(["facturapi-reconciliar-cancelaciones", "facturapi-webhook"])(
    "el paquete de %s resuelve sus dependencias sin otra función Edge",
    (nombre) => {
      const directorio = resolve(FN, nombre);
      const compartido = resolve(FN, "_shared");
      const pendientes = [join(directorio, "index.ts")];
      const visitados = new Set<string>();
      while (pendientes.length > 0) {
        const archivo = pendientes.pop()!;
        if (visitados.has(archivo)) continue;
        visitados.add(archivo);
        for (const { fileName } of preProcessFile(leer(archivo)).importedFiles) {
          if (!fileName.startsWith(".")) continue;
          const destino = resolve(dirname(archivo), fileName);
          expect(destino.startsWith(directorio + sep) || destino.startsWith(compartido + sep),
            `${archivo} importa ${fileName} fuera del paquete`).toBe(true);
          pendientes.push(destino);
        }
      }
    },
  );

  it("si no se puede guardar el pendiente se responde 500 recuperable", () => {
    for (const f of [
      `${FN}/facturapi-emitir/pendiente.ts`,
      `${FN}/facturapi-emitir-nota-credito/pendiente.ts`,
      `${FN}/facturapi-emitir-rep/pendiente.ts`,
    ]) {
      const src = leer(f);
      expect(src).toContain("cuerpoPendienteNoPersistido");
      expect(src).toContain("500");
      expect(src).toContain("no_persistido");
    }
  });
});
