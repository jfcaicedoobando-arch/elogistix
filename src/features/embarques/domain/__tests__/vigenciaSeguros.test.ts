import { afterEach, describe, expect, it, vi } from "vitest";
import { contarVigenciasSeguros, diasRestantesSeguro } from "../vigenciaSeguros";
afterEach(() => vi.useRealTimers());
describe("Audit149: pólizas vencidas y próximas separadas", () => {
  it.each([["2026-10-05", -1], ["2026-10-06", 0], ["2026-10-07", 1], ["2026-10-13", 7], ["2026-10-14", 8]] as const)("%s => %i días", (fecha, dias) => {
    expect(diasRestantesSeguro(fecha, "2026-10-06")).toBe(dias);
  });
  it("incluye hoy y límite7, excluye eliminadas y nunca cuenta vencidas como futuras", () => {
    const seguros = ["2026-09-01", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-13", "2026-10-14"].map(vigencia_hasta => ({ vigencia_hasta }));
    expect(contarVigenciasSeguros([...seguros, { vigencia_hasta: "2026-10-01", deleted_at: "2026-10-03" }], "2026-10-06")).toEqual({ vencidas: 2, porVencer: 3 });
  });
  it("usa díaMéxico aunque UTC ya esté al día siguiente", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-07T02:00:00Z"));
    expect(diasRestantesSeguro("2026-10-06")).toBe(0);
  });
});
