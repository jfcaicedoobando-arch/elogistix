import { describe, it, expect } from "vitest";
import { computeCliente360Totals } from "@/features/crm/domain/cliente360";
import type { EtapaTipo } from "@/features/crm/domain/forecast";

const tipos = new Map<string, EtapaTipo>([
  ["abierta", "abierta"],
  ["ganada", "ganada"],
  ["perdida", "perdida"],
]);

describe("computeCliente360Totals", () => {
  it("acumula abierto desde monto_estimado y ganado prefiere valor_real", () => {
    const r = computeCliente360Totals(
      [
        { etapa_id: "abierta", monto_estimado: 1000, valor_real: null },
        { etapa_id: "abierta", monto_estimado: "500", valor_real: null },
        { etapa_id: "ganada", monto_estimado: 2000, valor_real: 2500 },
        { etapa_id: "ganada", monto_estimado: 800, valor_real: null },
        { etapa_id: "perdida", monto_estimado: 999, valor_real: null },
        { etapa_id: null, monto_estimado: 123, valor_real: null },
      ],
      tipos,
    );
    expect(r).toHaveLength(1);
    expect(r[0].moneda).toBe("MXN");
    expect(r[0].totalAbierto).toBe(1500);
    expect(r[0].totalGanado).toBe(2500 + 800);
  });

  it("devuelve arreglo vacío para input vacío", () => {
    expect(computeCliente360Totals([], tipos)).toEqual([]);
  });

  it("separa totales por moneda sin mezclarlos (100k MXN + 10k USD + importe EUR)", () => {
    const r = computeCliente360Totals(
      [
        { etapa_id: "abierta", monto_estimado: 100000, valor_real: null, moneda: "MXN" },
        { etapa_id: "abierta", monto_estimado: 10000, valor_real: null, moneda: "USD" },
        { etapa_id: "ganada", monto_estimado: 5000, valor_real: 4800, moneda: "EUR" },
      ],
      tipos,
    );
    expect(r).toHaveLength(3);
    const mxn = r.find((x) => x.moneda === "MXN")!;
    const usd = r.find((x) => x.moneda === "USD")!;
    const eur = r.find((x) => x.moneda === "EUR")!;
    expect(mxn.totalAbierto).toBe(100000);
    expect(mxn.totalGanado).toBe(0);
    expect(usd.totalAbierto).toBe(10000);
    expect(usd.totalGanado).toBe(0);
    expect(eur.totalAbierto).toBe(0);
    expect(eur.totalGanado).toBe(4800);
  });
});
