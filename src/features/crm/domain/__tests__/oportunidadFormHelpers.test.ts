/**
 * Tests de helpers del formulario de Oportunidad CRM.
 * Cubre la hidratación desde un row existente y la construcción del estado
 * inicial "Nueva" con etapa default + vendedor autenticado.
 */
import { describe, it, expect } from "vitest";
import { buildFromOportunidad, buildEmptyForNueva } from "../oportunidadFormHelpers";
import { EMPTY_OPORTUNIDAD } from "../oportunidadFormState";
import type { CrmOportunidadRow } from "@/features/crm/types/oportunidades";
import type { User } from "@supabase/supabase-js";

// SAFE-CAST: en runtime sólo accedemos a los campos declarados; el resto del
// shape de CrmOportunidadRow (timestamps, FKs) es irrelevante para los helpers.
const baseRow = {
  nombre: "Embarque Hapag",
  cliente_id: "c1",
  cliente_nombre: "ACME",
  etapa_id: "et1",
  monto_estimado: 1250.5,
  moneda: "USD",
  probabilidad: 60,
  fecha_estimada_cierre: "2026-08-15",
  modo: "FCL",
  origen: "CNSHA",
  destino: "MXZLO",
  notas: "rush",
  vendedor_id: "v1",
  vendedor_email: "ana@acme.mx",
} as unknown as CrmOportunidadRow;

describe("buildFromOportunidad", () => {
  it("hidrata todos los campos directamente", () => {
    const out = buildFromOportunidad(baseRow);
    expect(out).toMatchObject({
      nombre: "Embarque Hapag",
      cliente_nombre: "ACME",
      monto_estimado: 1250.5,
      moneda: "USD",
      probabilidad: 60,
      vendedor_email: "ana@acme.mx",
    });
  });

  it("aplica defaults seguros cuando los campos opcionales son null", () => {
    const row = {
      ...baseRow,
      cliente_id: null,
      cliente_nombre: null,
      monto_estimado: null,
      moneda: null,
      probabilidad: null,
      fecha_estimada_cierre: null,
      modo: null,
      origen: null,
      destino: null,
      notas: null,
      vendedor_id: null,
      vendedor_email: null,
    } as unknown as CrmOportunidadRow;
    const out = buildFromOportunidad(row);
    expect(out.cliente_id).toBeNull();
    expect(out.cliente_nombre).toBe("");
    expect(out.monto_estimado).toBe(0);
    expect(out.moneda).toBe("MXN");
    expect(out.probabilidad).toBe(0);
    expect(out.fecha_estimada_cierre).toBe("");
    expect(out.modo).toBe("");
    expect(out.vendedor_id).toBeNull();
    expect(out.vendedor_email).toBe("");
  });

  it("convierte monto_estimado string a número", () => {
    const row = { ...baseRow, monto_estimado: "999.99" } as unknown as CrmOportunidadRow;
    expect(buildFromOportunidad(row).monto_estimado).toBe(999.99);
  });
});

describe("buildEmptyForNueva", () => {
  it("usa la primera etapa y su probabilidad default", () => {
    const out = buildEmptyForNueva(
      [{ id: "et1", probabilidad_default: 25, tipo: "abierta" }, { id: "et2", probabilidad_default: 50, tipo: "abierta" }],
      null,
    );
    expect(out).toMatchObject({ ...EMPTY_OPORTUNIDAD, etapa_id: "et1", probabilidad: 25 });
  });

  it("incluye al usuario autenticado como vendedor", () => {
    const user = { id: "u1", email: "ops@lc.mx" } as unknown as User;
    const out = buildEmptyForNueva([{ id: "et1", probabilidad_default: 10, tipo: "abierta" }], user);
    expect(out.vendedor_id).toBe("u1");
    expect(out.vendedor_email).toBe("ops@lc.mx");
  });

  it("maneja lista de etapas vacía sin lanzar", () => {
    const out = buildEmptyForNueva([], null);
    expect(out.etapa_id).toBe("");
    expect(out.probabilidad).toBe(0);
    expect(out.vendedor_id).toBeNull();
  });
});
