import { describe, it, expect } from "vitest";
import { SALES, hasRole } from "../permissionMatrix";

/**
 * v13.750.0 — Espejo de `public.puede_escribir_cotizaciones()`.
 * Si esta lista se desincroniza de la función SQL, el wizard abre pero el
 * guardado truena con RLS 42501 (caso reportado por coordinador_logistico).
 */
describe("SALES · escritura en cotizaciones", () => {
  const permitidos = [
    "super_admin",
    "admin_org",
    "admin",
    "gerente_comercial",
    "vendedor",
    "ejecutivo_pricing",
    "coordinador_logistico",
    "gerente_operaciones",
    "operador",
    "customer_service",
  ] as const;

  it.each(permitidos)("%s puede escribir cotizaciones", (rol) => {
    expect(hasRole(SALES, rol)).toBe(true);
  });

  it.each(["viewer", "gerente_visor", "cliente", "contador", "tesorero"] as const)(
    "%s NO puede escribir cotizaciones",
    (rol) => {
      expect(hasRole(SALES, rol)).toBe(false);
    },
  );

  it("no crece sin actualizar la función SQL", () => {
    expect(SALES).toHaveLength(permitidos.length);
  });
});
