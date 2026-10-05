import { describe, expect, it } from "vitest";
import { carteraEmptyState } from "../carteraEmptyState";

const base = { search: "", moneda: "todas", urgencia: "accionable" };
describe("Cobranza: alcance del estado vacío", () => {
  it.each([{ search: "ABC" }, { moneda: "USD" }, { dateFrom: "2026-09-01" }, { dateTo: "2026-09-30" }])(
    "no afirma cartera cobrada ante un filtro sin resultados: %j", (filtro) => {
      expect(carteraEmptyState({ ...base, ...filtro }).message).toBe("Sin resultados para estos filtros");
    },
  );
  it("explica la ventana de urgencia por defecto y ofrece toda la cartera", () => {
    const empty = carteraEmptyState(base);
    expect(empty.message).toContain("próximos 7 días");
    expect(empty.hint).toContain("Todas con saldo");
  });
  it("acota los mensajes para vencidas, por vencer y cartera completa", () => {
    expect(carteraEmptyState({ ...base, urgencia: "vencidas" }).message).toBe("Sin facturas vencidas");
    expect(carteraEmptyState({ ...base, urgencia: "por_vencer" }).message).toBe("Sin facturas por vencer en los próximos 7 días");
    expect(carteraEmptyState({ ...base, urgencia: "todas" }).message).toBe("Sin facturas con saldo pendiente");
  });
});
