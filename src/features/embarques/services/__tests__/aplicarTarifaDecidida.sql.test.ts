/**
 * R201-COT-01 (remate) · Contrato SQL de `_embarque_aplicar_tarifa_decidida`.
 *
 * Alcance honesto: esta prueba verifica el CONTRATO del texto SQL entregado
 * (espejo canónico y migración sincronizados), no ejecuta la función ni valida
 * importes reales — eso corresponde a las suites SQL/RLS de GitHub Actions.
 *
 * Lo que se exige:
 *  1. Refrescar la MISMA tarifa resuelve el recargo por identidad exacta
 *     (`costeo_tarifa_recargo_id`), no por búsqueda de texto: nombres repetidos
 *     no pueden confundirse.
 *  2. Sustituir por otra tarifa RECHAZA explícitamente cuando no hay
 *     equivalencia (0 filas) o es ambigua (> 1 fila). Prohibido el fallback
 *     silencioso al `costo_unitario` anterior.
 *  3. Sustituir RECHAZA cuando el proveedor/agente o la moneda de la tarifa
 *     sustituta no coinciden con la original.
 *  4. Sólo toca renglones importados de esa cotización (identidad de origen) y
 *     pendientes de liquidar; el histórico de la cotización no se modifica.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ESPEJO = join(ROOT, "supabase/schema/embarques/_embarque_aplicar_tarifa_decidida.sql");
const MIGRACION = join(
  ROOT,
  "supabase/migrations/20260913001100_r201_cot_remate_identidad_snapshot_hidratacion.sql",
);

const espejo = readFileSync(ESPEJO, "utf8");
const migracion = readFileSync(MIGRACION, "utf8");

function cuerpoHelper(sql: string): string {
  const inicio = sql.indexOf("CREATE OR REPLACE FUNCTION public._embarque_aplicar_tarifa_decidida(");
  const fin = sql.indexOf(
    "GRANT EXECUTE ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) TO service_role;",
    inicio,
  );
  expect(inicio).toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(inicio);
  return sql.slice(inicio, fin);
}

const cuerpo = cuerpoHelper(espejo);

describe("R201-COT-01 — espejo y migración sincronizados", () => {
  it("la migración pendiente lleva el mismo cuerpo que el espejo canónico", () => {
    expect(cuerpoHelper(migracion).trim()).toBe(cuerpo.trim());
  });

  it("cierra el acceso al cliente y sólo lo abre a service_role", () => {
    expect(espejo).toContain(
      "REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;",
    );
    expect(espejo).toContain(
      "GRANT EXECUTE ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) TO service_role;",
    );
  });
});

describe("R201-COT-01 — refrescar la misma tarifa usa identidad exacta", () => {
  it("distingue refrescar de sustituir comparando la tarifa de origen", () => {
    expect(cuerpo).toContain("v_es_sustitucion := p_tarifa_id_aplicada IS NOT NULL");
    expect(cuerpo).toContain("IS DISTINCT FROM v_tarifa_origen");
  });

  it("toma el monto del recargo unido por su id, no por concepto", () => {
    expect(cuerpo).toContain("LEFT JOIN public.costeo_tarifa_recargos r ON r.id = cc.costeo_tarifa_recargo_id");
    expect(cuerpo).toContain("v_unit := v_costo.recargo_monto_vigente;");
  });

  it("si el recargo de origen desapareció, rechaza en vez de reusar el viejo", () => {
    expect(cuerpo).toContain("IF v_costo.recargo_vigente_id IS NULL THEN");
    expect(cuerpo).toMatch(/ya no existe: no se puede refrescar/);
  });
});

describe("R201-COT-01 — sustituir sin equivalencia segura se rechaza", () => {
  it("rechaza cuando no hay cargo equivalente", () => {
    expect(cuerpo).toContain("IF COALESCE(v_equivalentes, 0) = 0 THEN");
    expect(cuerpo).toMatch(/no tiene un cargo equivalente/);
  });

  it("rechaza cuando la equivalencia es ambigua", () => {
    expect(cuerpo).toContain("IF v_equivalentes > 1 THEN");
    expect(cuerpo).toMatch(/la equivalencia es ambigua/);
  });

  it("ya no existe fallback silencioso al costo aceptado", () => {
    expect(cuerpo).not.toContain("v_unit := v_costo.costo_unitario;");
  });

  it("rechaza proveedor/agente distinto en la tarifa sustituta", () => {
    expect(cuerpo).toContain("v_ag_nueva IS DISTINCT FROM v_ag_origen");
    expect(cuerpo).toMatch(/pertenece a otro proveedor\/agente/);
  });

  it("rechaza moneda distinta en la tarifa sustituta y en el flete", () => {
    expect(cuerpo).toMatch(/La tarifa sustituta está en otra moneda/);
    expect(cuerpo).toMatch(/El flete de la tarifa aplicada está en/);
  });

  it("los rechazos son excepciones de negocio (P0001)", () => {
    const rechazos = cuerpo.match(/RAISE EXCEPTION/g) ?? [];
    const codigos = cuerpo.match(/ERRCODE = 'P0001'/g) ?? [];
    expect(rechazos.length).toBeGreaterThanOrEqual(6);
    expect(codigos.length).toBe(rechazos.length);
  });
});

describe("R201-COT-01 — alcance del UPDATE", () => {
  it("sólo actualiza renglones de esa cotización pendientes de liquidar", () => {
    expect(cuerpo).toContain("c.cotizacion_costo_origen_id = v_costo.id");
    expect(cuerpo).toContain("c.estado_liquidacion = 'Pendiente'::estado_liquidacion");
    expect(cuerpo).toContain("c.origen IN ('cotizacion','costeo_tarifa')");
  });

  it("no modifica el histórico de la cotización", () => {
    expect(cuerpo).not.toContain("UPDATE public.cotizacion_costos");
    expect(cuerpo).not.toContain("UPDATE public.conceptos_venta");
  });
});
