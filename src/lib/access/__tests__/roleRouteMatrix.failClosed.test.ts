import { describe, it, expect } from "vitest";
import { hasRouteAccess, RUTAS_LIBRES } from "@/lib/access/roleRouteMatrix";

/**
 * M11 (Ola 4) — La matriz de rutas es fail-closed: una ruta desconocida se
 * deniega salvo que esté en `RUTAS_LIBRES`. `/admin/*` es sólo super_admin.
 */
describe("roleRouteMatrix · fail-closed", () => {
  it("deniega rutas no listadas en la matriz", () => {
    expect(hasRouteAccess("admin", "/ruta-inexistente")).toBe(false);
    expect(hasRouteAccess("super_admin", "/otra/no/existe")).toBe(false);
  });

  it("permite las rutas libres a cualquier rol autenticado", () => {
    for (const ruta of RUTAS_LIBRES) {
      expect(hasRouteAccess("viewer", ruta)).toBe(true);
    }
  });

  it("reserva /admin y sus subrutas a super_admin", () => {
    expect(hasRouteAccess("super_admin", "/admin")).toBe(true);
    expect(hasRouteAccess("super_admin", "/admin/organizaciones/1")).toBe(true);
    expect(hasRouteAccess("admin", "/admin")).toBe(false);
    expect(hasRouteAccess("admin_org", "/admin/auditoria")).toBe(false);
    expect(hasRouteAccess(null, "/admin")).toBe(false);
  });

  it("protege /inicio y /operaciones frente a roles de portal", () => {
    expect(hasRouteAccess("cliente", "/inicio")).toBe(false);
    expect(hasRouteAccess("agente_carga", "/operaciones")).toBe(false);
    expect(hasRouteAccess("tesorero", "/operaciones")).toBe(true);
    expect(hasRouteAccess("vendedor", "/inicio")).toBe(true);
  });

  it("sin rol nunca hay acceso a rutas de negocio", () => {
    expect(hasRouteAccess(null, "/embarques")).toBe(false);
    expect(hasRouteAccess(undefined, "/facturacion")).toBe(false);
  });
});
