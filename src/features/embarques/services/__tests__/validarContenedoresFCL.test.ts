import { describe, it, expect } from "vitest";
import { validarContenedoresFCL } from "../validarContenedoresFCL";

const fcl = { modo: "Marítimo" as const, tipo_servicio: "FCL" as const };
const lcl = { modo: "Marítimo" as const, tipo_servicio: "LCL" as const };
const aereo = { modo: "Aéreo" as const, tipo_servicio: "FCL" as const };

describe("validarContenedoresFCL", () => {
  it("FCL marítimo con todos los contenedores completos → ok", () => {
    const r = validarContenedoresFCL(fcl, [
      { peso_kg: 1000, volumen_m3: 25 },
      { peso_kg: 2000, volumen_m3: 50 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.aplica).toBe(true);
    expect(r.incompletos).toBe(0);
  });

  it("FCL marítimo con peso=0 en uno → falla y reporta 1", () => {
    const r = validarContenedoresFCL(fcl, [
      { peso_kg: 0, volumen_m3: 25 },
      { peso_kg: 2000, volumen_m3: 50 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.incompletos).toBe(1);
    expect(r.mensaje).toMatch(/contenedor/i);
  });

  it("FCL marítimo con volumen=0 en varios → falla y reporta cantidad", () => {
    const r = validarContenedoresFCL(fcl, [
      { peso_kg: 1000, volumen_m3: 0 },
      { peso_kg: 2000, volumen_m3: 0 },
      { peso_kg: 3000, volumen_m3: 30 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.incompletos).toBe(2);
    expect(r.mensaje).toMatch(/2/);
  });

  it("LCL marítimo → siempre ok (no aplica)", () => {
    const r = validarContenedoresFCL(lcl, [{ peso_kg: 0, volumen_m3: 0 }]);
    expect(r.ok).toBe(true);
    expect(r.aplica).toBe(false);
  });

  it("Aéreo → siempre ok (no aplica)", () => {
    const r = validarContenedoresFCL(aereo, [{ peso_kg: 0, volumen_m3: 0 }]);
    expect(r.ok).toBe(true);
    expect(r.aplica).toBe(false);
  });

  it("FCL marítimo sin contenedores → ok (sin filas que violen)", () => {
    const r = validarContenedoresFCL(fcl, []);
    expect(r.ok).toBe(true);
    expect(r.incompletos).toBe(0);
  });
});
