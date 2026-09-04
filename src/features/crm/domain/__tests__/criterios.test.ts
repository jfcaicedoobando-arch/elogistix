import { describe, it, expect } from "vitest";
import {
  avisoCriteriosPendientes,
  estadoMeta,
  porcentajeCriterios,
  semaforoCriterios,
  totalesEtapa,
} from "@/features/crm/domain/criterios";

describe("semaforoCriterios", () => {
  it("marca sin_criterios cuando no hay checklist", () => {
    expect(semaforoCriterios(undefined)).toBe("sin_criterios");
    expect(semaforoCriterios({ total: 0, cumplidos: 0, obligatoriosPendientes: 0 })).toBe("sin_criterios");
  });

  it("distingue completo de incompleto", () => {
    expect(semaforoCriterios({ total: 3, cumplidos: 3, obligatoriosPendientes: 0 })).toBe("completo");
    expect(semaforoCriterios({ total: 3, cumplidos: 1, obligatoriosPendientes: 1 })).toBe("incompleto");
  });
});

describe("porcentajeCriterios", () => {
  it("devuelve fracción acotada a 1", () => {
    expect(porcentajeCriterios({ total: 4, cumplidos: 2, obligatoriosPendientes: 0 })).toBe(0.5);
    expect(porcentajeCriterios({ total: 2, cumplidos: 5, obligatoriosPendientes: 0 })).toBe(1);
    expect(porcentajeCriterios(undefined)).toBe(0);
  });
});

describe("avisoCriteriosPendientes", () => {
  it("no avisa si todo está cumplido o no hay criterios", () => {
    expect(avisoCriteriosPendientes({ total: 2, cumplidos: 2, obligatoriosPendientes: 0 }, "Propuesta")).toBeNull();
    expect(avisoCriteriosPendientes(undefined, "Propuesta")).toBeNull();
  });

  it("detalla pendientes y obligatorios", () => {
    const msg = avisoCriteriosPendientes({ total: 3, cumplidos: 1, obligatoriosPendientes: 1 }, "Propuesta");
    expect(msg).toContain("Faltan 2 criterios de Propuesta");
    expect(msg).toContain("1 obligatorio");
  });
});

describe("estadoMeta", () => {
  it("calcula avance contra la meta", () => {
    const r = estadoMeta(
      { montoEstimado: 50_000, montoMeta: 100_000, fechaMetaCierre: "2026-12-31", cerrada: false },
      "2026-08-01",
    );
    expect(r.avance).toBe(0.5);
    expect(r.metaVencida).toBe(false);
    expect(r.tieneMeta).toBe(true);
  });

  it("marca meta vencida sólo si sigue abierta", () => {
    const abierta = estadoMeta(
      { montoEstimado: 10, montoMeta: null, fechaMetaCierre: "2026-01-01", cerrada: false },
      "2026-08-01",
    );
    expect(abierta.metaVencida).toBe(true);
    expect(abierta.avance).toBeNull();

    const cerrada = estadoMeta(
      { montoEstimado: 10, montoMeta: null, fechaMetaCierre: "2026-01-01", cerrada: true },
      "2026-08-01",
    );
    expect(cerrada.metaVencida).toBe(false);
  });

  it("sin meta no reporta nada", () => {
    const r = estadoMeta(
      { montoEstimado: 10, montoMeta: 0, fechaMetaCierre: null, cerrada: false },
      "2026-08-01",
    );
    expect(r.tieneMeta).toBe(false);
  });
});

describe("totalesEtapa", () => {
  it("suma estimado, meta y ponderado dentro de la misma moneda", () => {
    const t = totalesEtapa([
      { monto_estimado: 100, monto_meta: 200, probabilidad: 50, moneda: "MXN" },
      { monto_estimado: 300, monto_meta: null, probabilidad: 10, moneda: "MXN" },
    ]);
    expect(t).toEqual({
      cantidad: 2,
      porMoneda: [{ moneda: "MXN", estimado: 400, meta: 200, ponderado: 80 }],
    });
  });

  it("NUNCA mezcla monedas distintas: reporta subtotales separados", () => {
    const t = totalesEtapa([
      { monto_estimado: 100, monto_meta: 0, probabilidad: 50, moneda: "MXN" },
      { monto_estimado: 300, monto_meta: 0, probabilidad: 10, moneda: "USD" },
    ]);
    expect(t.cantidad).toBe(2);
    expect(t.porMoneda).toEqual([
      { moneda: "MXN", estimado: 100, meta: 0, ponderado: 50 },
      { moneda: "USD", estimado: 300, meta: 0, ponderado: 30 },
    ]);
  });

  it("moneda ausente se asume MXN", () => {
    const t = totalesEtapa([{ monto_estimado: 50, monto_meta: 0, probabilidad: 0 }]);
    expect(t.porMoneda).toEqual([{ moneda: "MXN", estimado: 50, meta: 0, ponderado: 0 }]);
  });

  it("lista vacía da cero oportunidades y sin monedas", () => {
    expect(totalesEtapa([])).toEqual({ cantidad: 0, porMoneda: [] });
  });
});
