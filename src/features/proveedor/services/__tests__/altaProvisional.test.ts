import { describe, it, expect } from "vitest";
import { puedeAprobarProveedor } from "../altaProvisional";

describe("aprobación de proveedores provisionales", () => {
  it.each(["contador", "admin"])("%s puede aprobar", (rol) => {
    expect(puedeAprobarProveedor(rol)).toBe(true);
  });
  it.each(["pricing", "operador", "tesorero", "vendedor", null])("%s no puede aprobar", (rol) => {
    expect(puedeAprobarProveedor(rol)).toBe(false);
  });
});
