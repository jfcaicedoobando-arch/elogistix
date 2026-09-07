/**
 * R170-02 · Regresión de persistencia de la fecha de negocio.
 *
 * El test previo (`src/lib/date/__tests__/mx.test.ts`) sólo cubría `hoyMx()`
 * en el cliente, no lo que queda GUARDADO. Aquí se verifica el contrato real:
 *
 *  1. Las RPC que crean proforma y borradores de factura fechan con la hora de
 *     México dentro de su propia transacción (no CURRENT_DATE en UTC), y el
 *     vencimiento se deriva de esa misma fecha, así que los días de crédito se
 *     conservan (0 vence el mismo día, > 0 mantiene su plazo).
 *  2. El cliente ya NO hace un UPDATE de fecha "best-effort" después de crear,
 *     que podía fallar en silencio y dejaba la fecha al azar.
 *  3. La rama idempotente devuelve el documento existente sin redatarlo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRACION = join(
  ROOT,
  "supabase/migrations/20260913000400_r170_02_fecha_negocio_mx.sql",
);
const ESPEJO = join(ROOT, "supabase/schema/proformas/convertir_proformas_a_factura.sql");

const migracion = readFileSync(MIGRACION, "utf8");
const espejo = readFileSync(ESPEJO, "utf8");
const crud = readFileSync(join(ROOT, "src/features/proformas/services/crud.ts"), "utf8");
const convertir = readFileSync(
  join(ROOT, "src/features/proformas/services/convertirAFactura.ts"),
  "utf8",
);

/** Cuerpo de una función dentro del SQL de la migración. */
function cuerpo(sql: string, nombre: string): string {
  const inicio = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  expect(inicio, `no se encontró ${nombre} en la migración`).toBeGreaterThan(-1);
  const desde = sql.slice(inicio);
  const fin = desde.indexOf("$function$;");
  return desde.slice(0, fin);
}

describe("R170-02 · fecha de negocio persistida en hora México", () => {
  it("crear_proforma_atomica fecha la proforma con la hora de México en su transacción", () => {
    const fn = cuerpo(migracion, "crear_proforma_atomica");
    expect(fn).toContain("(now() AT TIME ZONE 'America/Mexico_City')::date");
    expect(fn).toMatch(/fecha_emision/);
    // Sin CURRENT_DATE: el DEFAULT en UTC ya no decide la fecha.
    expect(fn.replace(/--.*$/gm, "")).not.toContain("CURRENT_DATE");
  });

  it("convertir_proformas_a_factura usa la misma fecha MX para emisión y vencimiento", () => {
    const fn = cuerpo(migracion, "convertir_proformas_a_factura");
    expect(fn).toContain("(now() AT TIME ZONE 'America/Mexico_City')::date");
    // El vencimiento se deriva de la fecha de emisión MX → conserva el plazo,
    // incluido crédito 0 (mismo día) y crédito > 0.
    expect(fn).toContain("v_hoy_mx + make_interval(days => v_dias)");
    expect(fn.replace(/--.*$/gm, "")).not.toContain("CURRENT_DATE");
  });

  it("la rama idempotente devuelve las facturas existentes sin redatarlas", () => {
    const fn = cuerpo(migracion, "convertir_proformas_a_factura");
    const idem = fn.slice(fn.indexOf("idempotency_claim"), fn.indexOf("IF p_proforma_ids IS NULL"));
    expect(idem).toContain("RETURN QUERY SELECT * FROM public.facturas");
    expect(idem).not.toContain("UPDATE");
    expect(idem).not.toContain("v_hoy_mx");
  });

  it("el espejo canónico queda sincronizado con la migración", () => {
    expect(espejo).toContain("(now() AT TIME ZONE 'America/Mexico_City')::date");
    expect(espejo).toContain("20260913000400_r170_02_fecha_negocio_mx.sql");
  });

  it("el cliente no vuelve a parchar fechas después de crear/convertir", () => {
    for (const src of [crud, convertir]) {
      expect(src).not.toContain("hoyMx");
      expect(src).not.toContain("fecha_emision:");
    }
    expect(convertir).not.toContain("corregirFechaNegocioBorradores");
  });
});
