import { describe, it, expect } from "vitest";
import { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";

describe("deriveFacturaFlags", () => {
  it("null / undefined → todos false", () => {
    expect(deriveFacturaFlags(null, true)).toEqual({
      sinTimbrar: false,
      esBorrador: false,
      puedeEditarBorrador: false,
      puedeEliminarBorrador: false,
    });
  });

  it("Borrador sin facturapi_id + canEdit → editable y eliminable", () => {
    expect(
      deriveFacturaFlags({ estado: "Borrador", facturapi_id: null, uuid_fiscal: null }, true),
    ).toEqual({
      sinTimbrar: true,
      esBorrador: true,
      puedeEditarBorrador: true,
      puedeEliminarBorrador: true,
    });
  });

  it("Borrador sin canEdit → sólo lectura", () => {
    const r = deriveFacturaFlags({ estado: "Borrador", facturapi_id: null }, false);
    expect(r.esBorrador).toBe(true);
    expect(r.puedeEditarBorrador).toBe(false);
    expect(r.puedeEliminarBorrador).toBe(false);
  });

  it("Borrador con facturapi_id → ya no es borrador editable", () => {
    const r = deriveFacturaFlags({ estado: "Borrador", facturapi_id: "abc" }, true);
    expect(r.esBorrador).toBe(false);
    expect(r.puedeEliminarBorrador).toBe(false);
  });

  it("Timbrada → sinTimbrar false", () => {
    const r = deriveFacturaFlags({ estado: "Timbrada", uuid_fiscal: "UUID-1" }, true);
    expect(r.sinTimbrar).toBe(false);
    expect(r.esBorrador).toBe(false);
  });
});
