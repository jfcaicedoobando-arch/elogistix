import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fechaMinimaTraspaso, validarFechaTraspaso } from "../traspasoFecha";

describe("49 · fecha mínima inclusiva del traspaso", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T18:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it.each([
    ["2026-10-03", "2026-10-01"], ["2026-10-01", "2026-10-03"], ["2026-10-03", "2026-10-03"],
  ])("usa el mayor corte entre origen %s y destino %s", (origen, destino) => {
    const minima = fechaMinimaTraspaso({ fecha_saldo_inicial: origen }, { fecha_saldo_inicial: destino });
    expect(minima).toBe("2026-10-03");
    expect(validarFechaTraspaso("2026-10-02", minima)).toContain("03/10/2026");
    expect(validarFechaTraspaso("2026-10-03", minima)).toBeNull();
    expect(validarFechaTraspaso("2026-10-04", minima)).toBeNull();
  });
  it("conserva las guardas de fecha requerida y no futura", () => {
    expect(validarFechaTraspaso("", "2026-10-03")).toContain("Captura");
    expect(validarFechaTraspaso("2026-10-05", "2026-10-03")).toContain("futura");
  });
  it("expone el corte de una cuenta seleccionada y no inventa otro", () => {
    expect(fechaMinimaTraspaso()).toBeUndefined();
    expect(fechaMinimaTraspaso(undefined, { fecha_saldo_inicial: "2026-10-03" })).toBe("2026-10-03");
  });
});
