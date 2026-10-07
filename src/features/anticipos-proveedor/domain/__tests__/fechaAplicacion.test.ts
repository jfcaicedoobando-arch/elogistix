import { describe, expect, it } from "vitest";
import { errorFechaAplicacion, fechaMinimaAplicacion } from "../fechaAplicacion";

describe("audit135 · cronología civil de anticipos", () => {
  it("usa la fecha posterior sin cambiar la captura", () => {
    expect(fechaMinimaAplicacion("2026-10-06", "2026-10-05")).toBe("2026-10-06");
    expect(fechaMinimaAplicacion("2026-10-05", "2026-10-07")).toBe("2026-10-07");
    expect(fechaMinimaAplicacion(undefined, "2026-10-07")).toBe("2026-10-07");
  });
  it("rechaza fecha vacía, anterior y futura; acepta el límite", () => {
    expect(errorFechaAplicacion("", "2026-10-06", "2026-10-07")).not.toBeNull();
    expect(errorFechaAplicacion("2026-10-05", "2026-10-06", "2026-10-07")).not.toBeNull();
    expect(errorFechaAplicacion("2026-10-08", "2026-10-06", "2026-10-07")).not.toBeNull();
    expect(errorFechaAplicacion("2026-10-06", "2026-10-06", "2026-10-07")).toBeNull();
  });
});
