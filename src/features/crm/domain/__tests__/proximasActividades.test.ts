import { describe, it, expect } from "vitest";
import {
  buildProximasMap,
  esVencida,
  esHoy,
  type ActividadRowLite,
} from "@/lib/crm/proximasActividades";

function a(partial: Partial<ActividadRowLite> & { id: string; entidad_id: string }): ActividadRowLite {
  return {
    entidad_tipo: "oportunidad",
    tipo: "llamada",
    asunto: "Seguimiento",
    fecha_programada: "2026-06-01T10:00:00Z",
    ...partial,
  };
}

describe("buildProximasMap", () => {
  it("conserva sólo la primera ocurrencia por entidad_id (orden de entrada)", () => {
    const m = buildProximasMap([
      a({ id: "1", entidad_id: "op-1", fecha_programada: "2026-06-01" }),
      a({ id: "2", entidad_id: "op-1", fecha_programada: "2026-06-05" }),
      a({ id: "3", entidad_id: "op-2", fecha_programada: "2026-06-10" }),
    ]);
    expect(m.size).toBe(2);
    expect(m.get("op-1")?.id).toBe("1");
    expect(m.get("op-2")?.id).toBe("3");
  });

  it("devuelve mapa vacío para input vacío", () => {
    expect(buildProximasMap([]).size).toBe(0);
  });
});

describe("esVencida / esHoy", () => {
  const hoy = new Date(2026, 5, 15, 12, 0); // 15-jun-2026 12:00 local

  it("marca como vencida una fecha anterior a hoy", () => {
    expect(esVencida("2026-06-14T08:00:00", hoy)).toBe(true);
    expect(esVencida("2026-06-15T01:00:00", hoy)).toBe(false);
    expect(esVencida("2026-06-16T08:00:00", hoy)).toBe(false);
  });

  it("trata null / fecha inválida como no vencida", () => {
    expect(esVencida(null, hoy)).toBe(false);
    expect(esVencida("no-fecha", hoy)).toBe(false);
  });

  it("esHoy compara año/mes/día locales", () => {
    expect(esHoy("2026-06-15T00:00:00", hoy)).toBe(true);
    expect(esHoy("2026-06-14T23:59:59", hoy)).toBe(false);
    expect(esHoy(null, hoy)).toBe(false);
  });
});
