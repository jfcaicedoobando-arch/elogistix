/**
 * v13.823.370 (P1-1) — Candado de costos con aviso: fail-closed en la ruta de
 * revalidación (la que usa producción).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const tieneCostosCargados = vi.fn();
class CandadoCostosNoVerificableError extends Error {}
const notifyWarning = vi.fn();

vi.mock("@/features/cotizacion/services/candadoCostos", () => ({
  tieneCostosCargados: (...a: unknown[]) => tieneCostosCargados(...a),
  CandadoCostosNoVerificableError,
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyWarning: (...a: unknown[]) => notifyWarning(...a),
}));

const { verificarCostosOAvisar } = await import("../candadoCostosAviso");

beforeEach(() => {
  tieneCostosCargados.mockReset();
  notifyWarning.mockReset();
});

describe("verificarCostosOAvisar", () => {
  it("con costos: procede sin avisos", async () => {
    tieneCostosCargados.mockResolvedValue(true);
    await expect(verificarCostosOAvisar("cot-1")).resolves.toBe(true);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it("sin costos: bloquea y avisa", async () => {
    tieneCostosCargados.mockResolvedValue(false);
    await expect(verificarCostosOAvisar("cot-1")).resolves.toBe(false);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifyWarning.mock.calls[0][1].title).toContain("no tiene costos cargados");
  });

  it("verificación no concluyente: fail-closed y avisa que puede reintentarse", async () => {
    tieneCostosCargados.mockRejectedValue(new CandadoCostosNoVerificableError("x"));
    await expect(verificarCostosOAvisar("cot-1")).resolves.toBe(false);
    expect(notifyWarning.mock.calls[0][1].title).toContain("No pudimos verificar");
  });

  it("error inesperado: se propaga (no se silencia)", async () => {
    tieneCostosCargados.mockRejectedValue(new Error("boom"));
    await expect(verificarCostosOAvisar("cot-1")).rejects.toThrow("boom");
  });
});
