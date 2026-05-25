import { describe, it, expect } from "vitest";
import { buildFechasUpdate } from "../jsoncargoFechas";

describe("buildFechasUpdate", () => {
  it("retorna objeto vacío sin fechas", () => {
    expect(buildFechasUpdate({})).toEqual({});
  });

  it("incluye eta y etd cuando vienen", () => {
    expect(buildFechasUpdate({ eta: "2026-01-10", etd: "2026-01-01" })).toEqual({
      eta: "2026-01-10",
      etd: "2026-01-01",
    });
  });

  it("ata setea fecha_llegada_real y eta si falta", () => {
    expect(buildFechasUpdate({ ata: "2026-01-15" })).toEqual({
      fecha_llegada_real: "2026-01-15",
      eta: "2026-01-15",
    });
  });

  it("ata no sobrescribe eta cuando ya viene", () => {
    expect(buildFechasUpdate({ eta: "2026-01-10", ata: "2026-01-15" })).toEqual({
      eta: "2026-01-10",
      fecha_llegada_real: "2026-01-15",
    });
  });

  it("ignora valores null/undefined", () => {
    expect(buildFechasUpdate({ eta: null, etd: undefined, ata: null })).toEqual({});
  });
});
