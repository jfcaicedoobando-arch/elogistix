import { describe, it, expect } from "vitest";
import {
  computePipelinePonderado,
  computePipelinePonderadoPorMoneda,
  computeTopDeals,
  computeEmbudo,
  isoDaysFromNow,
  type OpRow,
  type EtapaRow,
} from "@/features/crm/domain/dashboardAggregates";

const ops: OpRow[] = [
  { id: "a", nombre: "A", cliente_nombre: "X", monto_estimado: 1000, moneda: "MXN", probabilidad: 50, fecha_estimada_cierre: null, etapa_id: "e1" },
  { id: "b", nombre: "B", cliente_nombre: "Y", monto_estimado: 2000, moneda: "MXN", probabilidad: 100, fecha_estimada_cierre: null, etapa_id: "e1" },
  { id: "c", nombre: "C", cliente_nombre: "Z", monto_estimado: 500, moneda: "MXN", probabilidad: 20, fecha_estimada_cierre: null, etapa_id: "e2" },
];
const etapas: EtapaRow[] = [
  { id: "e1", nombre: "Negociación", color: "#000", tipo: "abierta" },
  { id: "e2", nombre: "Propuesta", color: "#111", tipo: "abierta" },
];

describe("dashboardAggregates", () => {
  it("computePipelinePonderado suma monto * probabilidad/100", () => {
    expect(computePipelinePonderado(ops)).toBe(500 + 2000 + 100);
  });

  it("computePipelinePonderadoPorMoneda desglosa por moneda sin sumarlas entre sí", () => {
    const mixtas: OpRow[] = [
      ...ops,
      { id: "d", nombre: "D", cliente_nombre: "W", monto_estimado: 1000, moneda: "USD", probabilidad: 50, fecha_estimada_cierre: null, etapa_id: "e1" },
    ];
    const desglose = computePipelinePonderadoPorMoneda(mixtas);
    expect(desglose).toEqual([
      { moneda: "MXN", total: 500 + 2000 + 100 },
      { moneda: "USD", total: 500 },
    ]);
  });

  it("computeTopDeals ordena por ponderado desc y limita", () => {
    const top = computeTopDeals(ops, 2);
    expect(top.map((o) => o.id)).toEqual(["b", "a"]);
    expect(top[0].ponderado).toBe(2000);
  });

  it("computeEmbudo agrupa por etapa", () => {
    const embudo = computeEmbudo(ops, etapas);
    expect(embudo[0]).toMatchObject({ etapa_id: "e1", count: 2, monto: 3000 });
    expect(embudo[1]).toMatchObject({ etapa_id: "e2", count: 1, monto: 500 });
  });

  it("isoDaysFromNow devuelve YYYY-MM-DD", () => {
    expect(isoDaysFromNow(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
