/**
 * P1/P2 (v13.819.1) — La tarjeta "Por pagar" de `/inicio` enlazaba siempre a
 * `/compras/por-pagar`; el contador no tiene esa bandeja (ni en menú ni en el
 * guard) y caía en `/sin-acceso`. La tarjeta ahora enlaza a una vista permitida
 * con el mismo significado, sin ampliar permisos.
 */
import { describe, expect, it } from "vitest";
import { resolveDestinoPorPagar } from "../destinoPorPagar";
import { hasRouteAccess, COMPRAS_POR_PAGAR_ROLES } from "@/lib/access/roleRouteMatrix";

describe("resolveDestinoPorPagar", () => {
  it("intención canónica: contador NO gestiona la bandeja Por pagar", () => {
    expect(COMPRAS_POR_PAGAR_ROLES).not.toContain("contador");
    expect(hasRouteAccess("contador", "/compras/por-pagar")).toBe(false);
  });

  it("contador: lleva a facturas de proveedor (ruta permitida)", () => {
    const destino = resolveDestinoPorPagar("contador");
    expect(destino).toBe("/compras/facturas");
    expect(hasRouteAccess("contador", destino!)).toBe(true);
  });

  it("tesorero y admin: conservan la bandeja Por pagar", () => {
    expect(resolveDestinoPorPagar("tesorero")).toBe("/compras/por-pagar");
    expect(resolveDestinoPorPagar("admin")).toBe("/compras/por-pagar");
  });

  it("todo destino resuelto es accesible para el rol (sin /sin-acceso)", () => {
    const roles = ["contador", "tesorero", "admin", "admin_org", "auxiliar_contable",
      "gerente_operaciones", "gerente_visor", "ejecutivo_cobranza"] as const;
    for (const rol of roles) {
      const destino = resolveDestinoPorPagar(rol);
      expect(destino, `rol ${rol}`).toBeDefined();
      expect(hasRouteAccess(rol, destino!), `rol ${rol} → ${destino}`).toBe(true);
    }
  });

  it("sin rol no propone destino", () => {
    expect(resolveDestinoPorPagar(null)).toBeUndefined();
  });
});
