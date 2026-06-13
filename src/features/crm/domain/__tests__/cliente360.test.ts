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
    expect(r.totalAbierto).toBe(1500);
    expect(r.totalGanado).toBe(2500 + 800);
  });

  it("devuelve ceros para input vacío", () => {
    expect(computeCliente360Totals([], tipos)).toEqual({
      totalAbierto: 0,
      totalGanado: 0,
    });
  });
});
