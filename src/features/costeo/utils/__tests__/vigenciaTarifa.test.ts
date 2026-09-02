import { describe, it, expect } from "vitest";
import {
  resolverEstadoVigenciaTarifa,
  puedeAprobarTarifa,
  esVigenciaVencida,
} from "../vigenciaTarifa";

describe("vigenciaTarifa", () => {
  it("vence HOY no se considera vencida", () => {
    expect(esVigenciaVencida("2026-09-01", "2026-09-01")).toBe(false);
  });

  it("venció AYER sí se considera vencida", () => {
    expect(esVigenciaVencida("2026-08-31", "2026-09-01")).toBe(true);
  });

  it("borrador vencido sigue mostrando 'Pendiente' pero con advertencia visible", () => {
    const r = resolverEstadoVigenciaTarifa({
      estadoAprobacion: "borrador",
      vigenteHasta: "2026-07-06",
      hoy: "2026-09-01",
    });
    expect(r.estadoCanonico).toBe("Pendiente");
    expect(r.vencida).toBe(true);
    expect(r.advertencia).toContain("Pendiente · vigencia vencida el");
    expect(r.advertencia).toContain("06/07/2026");
  });

  it("borrador vigente no trae advertencia", () => {
    const r = resolverEstadoVigenciaTarifa({
      estadoAprobacion: "borrador",
      vigenteHasta: "2026-09-30",
      hoy: "2026-09-01",
    });
    expect(r.estadoCanonico).toBe("Pendiente");
    expect(r.vencida).toBe(false);
    expect(r.advertencia).toBeUndefined();
  });

  it("aprobada + vencida por fecha se muestra como Vencida", () => {
    const r = resolverEstadoVigenciaTarifa({
      estadoAprobacion: "vigente",
      estado: "vigente",
      vigenteHasta: "2026-08-31",
      hoy: "2026-09-01",
    });
    expect(r.estadoCanonico).toBe("Vencida");
  });

  it("no permite aprobar una tarifa con vigencia vencida", () => {
    expect(puedeAprobarTarifa({ vigenteHasta: "2026-07-06", hoy: "2026-09-01" })).toBe(false);
  });

  it("sí permite aprobar una tarifa vigente", () => {
    expect(puedeAprobarTarifa({ vigenteHasta: "2026-09-01", hoy: "2026-09-01" })).toBe(true);
    expect(puedeAprobarTarifa({ vigenteHasta: "2026-12-31", hoy: "2026-09-01" })).toBe(true);
  });
});
