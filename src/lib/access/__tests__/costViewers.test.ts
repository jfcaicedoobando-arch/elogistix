import { describe, expect, it } from "vitest";

import {
  COST_VIEWERS,
  FINANCE_VIEWERS,
  hasRole,
  puedeVerCostosCotizacion,
} from "@/lib/access/permissionMatrix";

/** QA B-07 — los roles comerciales no deben ver costo/utilidad/margen. */
describe("COST_VIEWERS (QA B-07)", () => {
  it("excluye vendedor y ejecutivo_pricing", () => {
    expect(hasRole(COST_VIEWERS, "vendedor")).toBe(false);
    expect(hasRole(COST_VIEWERS, "ejecutivo_pricing")).toBe(false);
  });

  it("mantiene finanzas, dirección y administradores", () => {
    for (const rol of ["super_admin", "admin_org", "admin", "contador", "tesorero", "gerente_operaciones"] as const) {
      expect(hasRole(COST_VIEWERS, rol)).toBe(true);
    }
  });

  it("es un subconjunto de FINANCE_VIEWERS", () => {
    for (const rol of COST_VIEWERS) {
      expect(FINANCE_VIEWERS).toContain(rol);
    }
    expect(COST_VIEWERS.length).toBeLessThan(FINANCE_VIEWERS.length);
  });
});

/** C9 (Ola E2 · B) — el vendedor sólo ve costos de SUS cotizaciones. */
describe("puedeVerCostosCotizacion (C9)", () => {
  it("permite al vendedor ver costos de su propia cotización", () => {
    expect(puedeVerCostosCotizacion("vendedor", true)).toBe(true);
  });

  it("niega al vendedor los costos de una cotización ajena", () => {
    expect(puedeVerCostosCotizacion("vendedor", false)).toBe(false);
  });

  it("no abre la puerta a ejecutivo_pricing por ser dueño", () => {
    expect(puedeVerCostosCotizacion("ejecutivo_pricing", true)).toBe(false);
  });

  it("los roles de COST_VIEWERS ven costos de cualquier cotización", () => {
    for (const rol of ["admin", "contador", "gerente_operaciones"] as const) {
      expect(puedeVerCostosCotizacion(rol, false)).toBe(true);
    }
  });

  it("sin rol no ve costos", () => {
    expect(puedeVerCostosCotizacion(null, true)).toBe(false);
  });
});
