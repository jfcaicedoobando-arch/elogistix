import { describe, expect, it } from "vitest";

import {
  COST_VIEWERS,
  FINANCE_VIEWERS,
  hasRole,
  puedeVerCostosCotizacion,
} from "@/lib/access/permissionMatrix";

/** C9 (decisión 2026-08-29) — gerencia, finanzas y ventas: TODOS ven costos. */
describe("COST_VIEWERS (C9)", () => {
  it("incluye ventas (vendedor y ejecutivo_pricing)", () => {
    expect(hasRole(COST_VIEWERS, "vendedor")).toBe(true);
    expect(hasRole(COST_VIEWERS, "ejecutivo_pricing")).toBe(true);
  });

  it("mantiene finanzas, gerencia y administradores", () => {
    for (const rol of [
      "super_admin",
      "admin_org",
      "admin",
      "contador",
      "tesorero",
      "gerente_operaciones",
      "gerente_comercial",
      "gerente_visor",
    ] as const) {
      expect(hasRole(COST_VIEWERS, rol)).toBe(true);
    }
  });

  it("es exactamente FINANCE_VIEWERS", () => {
    expect(COST_VIEWERS).toEqual(FINANCE_VIEWERS);
  });
});

describe("puedeVerCostosCotizacion (C9)", () => {
  it("el vendedor ve costos de cualquier cotización, propia o ajena", () => {
    expect(puedeVerCostosCotizacion("vendedor", true)).toBe(true);
    expect(puedeVerCostosCotizacion("vendedor", false)).toBe(true);
  });

  it("los roles de finanzas y gerencia ven costos de cualquier cotización", () => {
    for (const rol of ["admin", "contador", "gerente_operaciones"] as const) {
      expect(puedeVerCostosCotizacion(rol, false)).toBe(true);
    }
  });

  it("los roles operativos siguen sin ver costos", () => {
    expect(puedeVerCostosCotizacion("operador", true)).toBe(false);
    expect(puedeVerCostosCotizacion("coordinador_logistico", true)).toBe(false);
  });

  it("sin rol no ve costos", () => {
    expect(puedeVerCostosCotizacion(null, true)).toBe(false);
  });
});
