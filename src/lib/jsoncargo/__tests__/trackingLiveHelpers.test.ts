import { describe, it, expect } from "vitest";
import {
  jsoncargoDateToYmd,
  computeFechasPropuestas,
  buildApplyFechasArgs,
  derivePrefixState,
} from "@/lib/jsoncargo/trackingLiveHelpers";
import { PrefixMismatchError } from "@/lib/jsoncargo/summary";

describe("jsoncargoDateToYmd", () => {
  it("parsea 'YYYY-MM-DD HH:MM'", () => {
    expect(jsoncargoDateToYmd("2026-03-15 10:30")).toBe("2026-03-15");
  });
  it("devuelve null para valores vacíos o inválidos", () => {
    expect(jsoncargoDateToYmd(null)).toBeNull();
    expect(jsoncargoDateToYmd("")).toBeNull();
    expect(jsoncargoDateToYmd("not-a-date")).toBeNull();
  });
});

describe("computeFechasPropuestas", () => {
  it("retorna null si readOnly", () => {
    expect(
      computeFechasPropuestas({
        readOnly: true, summary: { eta_final_destination: "2026-01-01" },
        trackingStatus: "ok", fechasDismissed: false,
        eta: null, etd: null, ata: null,
      }),
    ).toBeNull();
  });
  it("detecta diferencia en ETA", () => {
    const out = computeFechasPropuestas({
      readOnly: false,
      summary: { eta_final_destination: "2026-01-10" },
      trackingStatus: "ok", fechasDismissed: false,
      eta: "2026-01-05", etd: null, ata: null,
    });
    expect(out?.etaDifiere).toBe(true);
    expect(out?.etaPropuesta).toBe("2026-01-10");
  });
  it("retorna null cuando no hay diferencias", () => {
    const out = computeFechasPropuestas({
      readOnly: false,
      summary: { eta_final_destination: "2026-01-10" },
      trackingStatus: "ok", fechasDismissed: false,
      eta: "2026-01-10", etd: null, ata: null,
    });
    expect(out).toBeNull();
  });
});

describe("buildApplyFechasArgs", () => {
  it("incluye sólo campos con diferencia", () => {
    const args = buildApplyFechasArgs("emb-1", {
      etaPropuesta: "2026-01-10", etdPropuesta: "2026-01-01", ataPropuesta: null,
      etaDifiere: true, etdDifiere: false, ataDifiere: false,
    });
    expect(args).toEqual({ embarqueId: "emb-1", eta: "2026-01-10", etd: undefined, ata: undefined });
  });
});

describe("derivePrefixState", () => {
  it("flagea sinContenedor", () => {
    const s = derivePrefixState({ contenedor: null, sl: null, tracking: null, syncError: null });
    expect(s.sinContenedor).toBe(true);
  });
  it("expone PrefixMismatchError del sync", () => {
    const err = new PrefixMismatchError("XYZ", "MAERSK", []);
    const s = derivePrefixState({ contenedor: "XYZU1234567", sl: null, tracking: null, syncError: err });
    expect(s.showPrefixWarning).toBe(true);
    expect(s.detectedPrefix).toBe("XYZ");
  });
});
