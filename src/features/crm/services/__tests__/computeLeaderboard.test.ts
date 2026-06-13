import { describe, it, expect } from "vitest";
import { computeLeaderboard } from "../index";

describe("computeLeaderboard", () => {
  const etapas = [
    { id: "e-ganada", tipo: "ganada" },
    { id: "e-abierta", tipo: "abierta" },
    { id: "e-perdida", tipo: "perdida" },
  ];

  it("agrupa por vendedor y sólo suma oportunidades ganadas", () => {
    const rows = computeLeaderboard({
      cuotas: [
        { vendedor_email: "a@x.com", cuota_monto: 1000 },
        { vendedor_email: "b@x.com", cuota_monto: 500 },
      ],
      ops: [
        { vendedor_email: "a@x.com", valor_real: 300, monto_estimado: 999, etapa_id: "e-ganada" },
        { vendedor_email: "a@x.com", valor_real: null, monto_estimado: 200, etapa_id: "e-ganada" },
        { vendedor_email: "a@x.com", valor_real: 9999, monto_estimado: null, etapa_id: "e-perdida" }, // ignorada
        { vendedor_email: "b@x.com", valor_real: 800, monto_estimado: null, etapa_id: "e-ganada" },
        { vendedor_email: null, valor_real: 100, monto_estimado: null, etapa_id: "e-ganada" }, // "Sin asignar"
      ],
      etapas,
    });
    // ordenado desc por cerrado: b(800) > a(500) > Sin asignar(100)
    expect(rows.map((r) => r.vendedor)).toEqual(["b@x.com", "a@x.com", "Sin asignar"]);
    const a = rows.find((r) => r.vendedor === "a@x.com")!;
    expect(a.cerrado).toBe(500);
    expect(a.cuota).toBe(1000);
    expect(a.avance).toBe(50);
    const b = rows.find((r) => r.vendedor === "b@x.com")!;
    expect(b.avance).toBe(100); // 800/500 capped at 100
  });

  it("devuelve avance 0 cuando cuota es 0", () => {
    const rows = computeLeaderboard({
      cuotas: [],
      ops: [
        { vendedor_email: "c@x.com", valor_real: 100, monto_estimado: null, etapa_id: "e-ganada" },
      ],
      etapas,
    });
    expect(rows[0]).toMatchObject({ vendedor: "c@x.com", cerrado: 100, cuota: 0, avance: 0 });
  });

  it("incluye vendedores con cuota pero sin cierre", () => {
    const rows = computeLeaderboard({
      cuotas: [{ vendedor_email: "d@x.com", cuota_monto: 500 }],
      ops: [],
      etapas,
    });
    expect(rows[0]).toMatchObject({ vendedor: "d@x.com", cerrado: 0, cuota: 500, avance: 0 });
  });
});
