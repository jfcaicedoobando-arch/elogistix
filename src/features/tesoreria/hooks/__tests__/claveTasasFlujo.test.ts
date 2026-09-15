/**
 * MNY-NEW-05 — el flujo proyectado no debe cachearse con un tipo de cambio a
 * medio cargar. La clave vale `null` mientras la consulta del T.C. no tiene
 * respuesta estable y cambia cuando el T.C. cambia, forzando recálculo.
 */
import { describe, it, expect } from "vitest";
import { claveTasasFlujo } from "../useFlujoProyectado";

describe("claveTasasFlujo", () => {
  it("pendiente: sin respuesta estable no hay clave (query deshabilitada)", () => {
    expect(claveTasasFlujo({ cargado: false, error: false })).toBeNull();
  });

  it("cargado: la clave incluye USD, EUR y fecha", () => {
    const k = claveTasasFlujo({
      cargado: true, error: false, usdMxn: 18.5, eurMxn: 20.1, fecha: "2026-06-26",
    });
    expect(k).toBe("usd:18.5|eur:20.1|f:2026-06-26");
  });

  it("un cambio de T.C. produce una clave distinta", () => {
    const a = claveTasasFlujo({ cargado: true, error: false, usdMxn: 18.5, eurMxn: 20.1, fecha: "2026-06-26" });
    const b = claveTasasFlujo({ cargado: true, error: false, usdMxn: 18.9, eurMxn: 20.1, fecha: "2026-06-27" });
    expect(a).not.toBe(b);
  });

  it("error del T.C. es un estado estable propio", () => {
    expect(claveTasasFlujo({ cargado: true, error: true })).toBe("tc-error");
  });

  it("faltante de EUR se distingue de EUR con valor", () => {
    const sin = claveTasasFlujo({ cargado: true, error: false, usdMxn: 18.5, eurMxn: null, fecha: "2026-06-26" });
    const con = claveTasasFlujo({ cargado: true, error: false, usdMxn: 18.5, eurMxn: 20.1, fecha: "2026-06-26" });
    expect(sin).toContain("eur:sin");
    expect(sin).not.toBe(con);
  });
});
