import { describe, it, expect } from "vitest";
import { resolveCierreGate, clasificarBloqueoAvance } from "../useEmbarqueEstadoActions.helpers";

describe("resolveCierreGate", () => {
  it("devuelve null cuando el cierre no es visible", () => {
    expect(resolveCierreGate(false, true, true)).toBeNull();
  });
  it("devuelve 'rol' cuando el cierre es visible y el rol no puede cerrar", () => {
    expect(resolveCierreGate(true, false, true)).toBe("rol");
  });
  it("devuelve 'checklist' cuando el rol puede pero la validación no pasa", () => {
    expect(resolveCierreGate(true, true, false)).toBe("checklist");
  });
  it("devuelve null cuando todo está OK", () => {
    expect(resolveCierreGate(true, true, true)).toBeNull();
  });
});

describe("clasificarBloqueoAvance", () => {
  const base = { docsBloqueantes: false, docsFaltantesCount: 0, siguiente: "Confirmado", bloqueoCierreMotivo: null, fechaLlegadaReal: null };
  it("block_docs cuando docs son bloqueantes y faltan", () => {
    expect(clasificarBloqueoAvance({ ...base, docsBloqueantes: true, docsFaltantesCount: 2 })).toBe("block_docs");
  });
  it("warn_docs cuando docs no son bloqueantes pero faltan", () => {
    expect(clasificarBloqueoAvance({ ...base, docsBloqueantes: false, docsFaltantesCount: 1 })).toBe("warn_docs");
  });
  it("gate_cierre cuando siguiente es Cerrado y hay bloqueo de cierre", () => {
    expect(clasificarBloqueoAvance({ ...base, siguiente: "Cerrado", bloqueoCierreMotivo: "checklist" })).toBe("gate_cierre");
  });
  it("block_fecha_llegada cuando siguiente es Arribo y falta fecha_llegada_real", () => {
    expect(clasificarBloqueoAvance({ ...base, siguiente: "Arribo", fechaLlegadaReal: null })).toBe("block_fecha_llegada");
  });
  it("ok cuando siguiente es Arribo y hay fecha_llegada_real", () => {
    expect(clasificarBloqueoAvance({ ...base, siguiente: "Arribo", fechaLlegadaReal: "2026-07-01" })).toBe("ok");
  });
  it("ok cuando no hay bloqueos", () => {
    expect(clasificarBloqueoAvance(base)).toBe("ok");
  });

});
