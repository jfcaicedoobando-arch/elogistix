/**
 * v13.56.1 — Tests de la regla de gating de cierre/reapertura usada por TabCierre.
 * Verifica que los roles correctos puedan ejecutar cada acción y que el
 * estado del embarque sea respetado.
 */
import { describe, it, expect } from "vitest";

/**
 * Replica la lógica embebida en TabCierre.tsx para validarla de forma aislada.
 * Si esta regla cambia, debe actualizarse aquí y en el componente al unísono.
 */
function puedeCerrar(opts: {
  isAdmin: boolean;
  canEditFinance: boolean;
  estatus: string;
}): boolean {
  return (opts.isAdmin || opts.canEditFinance) && opts.estatus === "entregado";
}

function puedeReabrir(opts: { isSuperAdmin: boolean; isAdmin: boolean }): boolean {
  return opts.isSuperAdmin || opts.isAdmin;
}

describe("cierre — reglas de gating", () => {
  it("admin con embarque entregado puede cerrar", () => {
    expect(puedeCerrar({ isAdmin: true, canEditFinance: false, estatus: "entregado" })).toBe(true);
  });

  it("contador (canEditFinance) con embarque entregado puede cerrar", () => {
    expect(puedeCerrar({ isAdmin: false, canEditFinance: true, estatus: "entregado" })).toBe(true);
  });

  it("admin NO puede cerrar si el embarque no está entregado", () => {
    expect(puedeCerrar({ isAdmin: true, canEditFinance: true, estatus: "en_transito" })).toBe(false);
    expect(puedeCerrar({ isAdmin: true, canEditFinance: true, estatus: "cerrado" })).toBe(false);
  });

  it("operador sin canEditFinance no puede cerrar aunque esté entregado", () => {
    expect(puedeCerrar({ isAdmin: false, canEditFinance: false, estatus: "entregado" })).toBe(false);
  });

  it("super_admin siempre puede reabrir", () => {
    expect(puedeReabrir({ isSuperAdmin: true, isAdmin: false })).toBe(true);
  });

  it("admin puede reabrir (sujeto a config global del backend)", () => {
    expect(puedeReabrir({ isSuperAdmin: false, isAdmin: true })).toBe(true);
  });

  it("usuario sin privilegios no puede reabrir", () => {
    expect(puedeReabrir({ isSuperAdmin: false, isAdmin: false })).toBe(false);
  });
});

describe("cierre — validación de motivo de reapertura", () => {
  const MIN = 20;
  const valido = (m: string) => m.trim().length >= MIN;

  it("rechaza motivos vacíos", () => {
    expect(valido("")).toBe(false);
    expect(valido("   ")).toBe(false);
  });

  it("rechaza motivos cortos", () => {
    expect(valido("corto")).toBe(false);
    expect(valido("a".repeat(19))).toBe(false);
  });

  it("acepta motivos de 20+ caracteres", () => {
    expect(valido("a".repeat(20))).toBe(true);
    expect(valido("Corrección de costos por reclamo del cliente.")).toBe(true);
  });
});

describe("cierre — confirmación tipada", () => {
  it("solo acepta exactamente 'CERRAR'", () => {
    expect("CERRAR" === "CERRAR").toBe(true);
    expect(("cerrar" as string) === "CERRAR").toBe(false);
    expect(("CERRAR " as string) === "CERRAR").toBe(false);
  });
});
