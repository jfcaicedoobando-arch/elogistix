import { describe, it, expect } from "vitest";
import { deriveFacturaFlags, esCreadaConCapacidadTimbrado, FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";

const POST = "2026-07-15";
const PRE = "2026-06-30";

describe("deriveFacturaFlags", () => {
  it("null / undefined → todos false", () => {
    expect(deriveFacturaFlags(null, true)).toEqual({
      sinTimbrar: false,
      esBorrador: false,
      puedeEditarBorrador: false,
      puedeEliminarBorrador: false,
      puedeTimbrarDesdeSistema: false,
      puedeCancelarCfdi: false,
      puedeSustituirCfdi: false,
      puedeRegistrarPago: false,
      repPendiente: false,
      estaCancelada: false,
    });
  });


  it("Borrador sin facturapi_id + canEdit + fecha post-corte → editable, eliminable y timbrable", () => {
    expect(
      deriveFacturaFlags(
        { estado: "Borrador", facturapi_id: null, uuid_fiscal: null, fecha_emision: POST },
        true,
      ),
    ).toEqual({
      sinTimbrar: true,
      esBorrador: true,
      puedeEditarBorrador: true,
      puedeEliminarBorrador: true,
      puedeTimbrarDesdeSistema: true,
      puedeCancelarCfdi: false,
      puedeSustituirCfdi: false,
      puedeRegistrarPago: false,
      repPendiente: false,
      estaCancelada: false,
    });
  });

  it("Timbrada + Emitida + canEdit → puede cancelar y sustituir CFDI", () => {
    const r = deriveFacturaFlags(
      { estado: "Emitida", uuid_fiscal: "UUID-1", fecha_emision: POST },
      true,
    );
    expect(r.puedeCancelarCfdi).toBe(true);
    expect(r.puedeSustituirCfdi).toBe(true);
  });

  it("Timbrada + Emitida + !canEdit → no puede cancelar/sustituir", () => {
    const r = deriveFacturaFlags(
      { estado: "Emitida", uuid_fiscal: "UUID-1", fecha_emision: POST },
      false,
    );
    expect(r.puedeCancelarCfdi).toBe(false);
    expect(r.puedeSustituirCfdi).toBe(false);
  });

  it("Cancelada → no puede cancelar de nuevo aunque esté timbrada", () => {
    const r = deriveFacturaFlags(
      { estado: "Cancelada", uuid_fiscal: "UUID-1", fecha_emision: POST },
      true,
    );
    expect(r.puedeCancelarCfdi).toBe(false);
    expect(r.puedeSustituirCfdi).toBe(false);
  });


  it("Borrador sin canEdit → sólo lectura", () => {
    const r = deriveFacturaFlags({ estado: "Borrador", facturapi_id: null, fecha_emision: POST }, false);
    expect(r.esBorrador).toBe(true);
    expect(r.puedeEditarBorrador).toBe(false);
    expect(r.puedeEliminarBorrador).toBe(false);
  });

  it("Borrador con facturapi_id → ya no es borrador editable", () => {
    const r = deriveFacturaFlags({ estado: "Borrador", facturapi_id: "abc", fecha_emision: POST }, true);
    expect(r.esBorrador).toBe(false);
    expect(r.puedeEliminarBorrador).toBe(false);
  });

  it("Timbrada → sinTimbrar y puedeTimbrarDesdeSistema en false", () => {
    const r = deriveFacturaFlags({ estado: "Timbrada", uuid_fiscal: "UUID-1", fecha_emision: POST }, true);
    expect(r.sinTimbrar).toBe(false);
    expect(r.esBorrador).toBe(false);
    expect(r.puedeTimbrarDesdeSistema).toBe(false);
  });

  it("Factura sin timbrar pero emitida antes del corte → puedeTimbrarDesdeSistema false", () => {
    const r = deriveFacturaFlags(
      { estado: "Emitida", facturapi_id: null, uuid_fiscal: null, fecha_emision: PRE },
      true,
    );
    expect(r.sinTimbrar).toBe(true);
    expect(r.puedeTimbrarDesdeSistema).toBe(false);
  });

  it("Factura sin fecha_emision → puedeTimbrarDesdeSistema false (fail-closed)", () => {
    const r = deriveFacturaFlags(
      { estado: "Emitida", facturapi_id: null, uuid_fiscal: null, fecha_emision: null },
      true,
    );
    expect(r.puedeTimbrarDesdeSistema).toBe(false);
  });



  it("Legacy: Emitida sin uuid_fiscal + saldo → puedeRegistrarPago true, no cancelable", () => {
    const r = deriveFacturaFlags(
      { estado: "Emitida", uuid_fiscal: null, fecha_emision: PRE },
      true,
      { saldo: 500 },
    );
    expect(r.puedeRegistrarPago).toBe(true);
    expect(r.puedeCancelarCfdi).toBe(false);
    expect(r.puedeSustituirCfdi).toBe(false);
    expect(r.puedeTimbrarDesdeSistema).toBe(false);
  });
});

describe("esCreadaConCapacidadTimbrado", () => {
  it("fecha nula → false", () => {
    expect(esCreadaConCapacidadTimbrado(null)).toBe(false);
    expect(esCreadaConCapacidadTimbrado(undefined)).toBe(false);
  });
  it("fecha antes del corte → false", () => {
    expect(esCreadaConCapacidadTimbrado(PRE)).toBe(false);
  });
  it("fecha después del corte → true", () => {
    expect(esCreadaConCapacidadTimbrado(POST)).toBe(true);
  });
  it("constante de corte apunta a 01/07/2026", () => {
    expect(FECHA_INICIO_TIMBRADO_SISTEMA.startsWith("2026-07-01")).toBe(true);
  });
});
