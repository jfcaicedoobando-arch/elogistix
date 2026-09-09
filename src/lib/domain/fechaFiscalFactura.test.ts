import { describe, it, expect } from "vitest";
import { fechaFiscalFactura, fechaMx } from "./fechaFiscalFactura";

describe("fechaFiscalFactura", () => {
  it("usa la fecha de certificación en hora de México cuando existe", () => {
    // 2026-09-01 18:46 UTC = 2026-09-01 12:46 en México.
    expect(
      fechaFiscalFactura({ fecha_emision: "2026-08-31", timbrado_en: "2026-09-01T18:46:29.040Z" }),
    ).toBe("2026-09-01");
  });

  it("cae a fecha_emision cuando no hay timbre", () => {
    expect(fechaFiscalFactura({ fecha_emision: "2026-08-31", timbrado_en: null })).toBe("2026-08-31");
  });

  it("respeta el desplazamiento de zona horaria hacia el día anterior", () => {
    // 2026-09-01 03:00 UTC = 2026-08-31 21:00 en México.
    expect(fechaMx("2026-09-01T03:00:00.000Z")).toBe("2026-08-31");
  });

  it("ignora un timbre con fecha inválida", () => {
    expect(fechaFiscalFactura({ fecha_emision: "2026-08-31", timbrado_en: "no-es-fecha" })).toBe("2026-08-31");
  });
});
