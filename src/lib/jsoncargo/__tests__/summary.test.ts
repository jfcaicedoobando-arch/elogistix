import { describe, it, expect } from "vitest";
import { extractSummary, PrefixMismatchError } from "@/lib/jsoncargo/summary";

describe("extractSummary", () => {
  it("retorna null para input inválido", () => {
    expect(extractSummary(null)).toBeNull();
    expect(extractSummary({})).toBeNull();
  });

  it("usa atd_origin cuando está presente (no estimado)", () => {
    const s = extractSummary({
      data: { atd_origin: "2026-01-10 10:00", container_status: "on vessel" },
    });
    expect(s?.etd_origin_effective).toBe("2026-01-10 10:00");
    expect(s?.etd_origin_is_estimated).toBe(false);
  });

  it("usa fallback last_movement_timestamp como ETD si contenedor zarpó", () => {
    const s = extractSummary({
      data: { container_status: "loaded onto vessel", last_movement_timestamp: "2026-01-11 09:00" },
    });
    expect(s?.etd_origin_effective).toBe("2026-01-11 09:00");
    expect(s?.etd_origin_is_estimated).toBe(true);
  });

  it("infiere ATA cuando container está descargado en puerto destino", () => {
    const s = extractSummary({
      data: {
        container_status: "discharged at port of discharge",
        last_location: "manzanillo terminal",
        discharging_port: "manzanillo",
        timestamp_of_last_location: "2026-02-01 08:00",
      },
    });
    expect(s?.ata_effective).toBe("2026-02-01 08:00");
    expect(s?.ata_is_inferred).toBe(true);
  });
});

describe("PrefixMismatchError", () => {
  it("conserva prefix, naviera y sugerencias", () => {
    const err = new PrefixMismatchError("XYZ", "MAERSK", []);
    expect(err.code).toBe("PREFIX_MISMATCH");
    expect(err.prefix).toBe("XYZ");
    expect(err.naviera).toBe("MAERSK");
  });
});
