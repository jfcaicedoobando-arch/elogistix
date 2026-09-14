/**
 * Regresión v13.823.366 — un embarque Terrestre pedía "aerolínea y MAWB"
 * porque cualquier modo ≠ Marítimo se trataba como Aéreo.
 */
import { describe, it, expect } from "vitest";
import { resolverTrackingCarrier } from "../trackingCarrier";

const base = {
  naviera: "Maersk",
  aerolinea: "AeroMéxico Cargo",
  blMaster: "MAEU123",
  mawb: "MAWB999",
};

describe("resolverTrackingCarrier", () => {
  it("[TC-01] Marítimo usa naviera y BL Master", () => {
    const r = resolverTrackingCarrier({ ...base, modo: "Marítimo" });
    expect(r).toMatchObject({ esMaritimo: true, carrier: "Maersk", referencia: "MAEU123", refLabel: "BL Master" });
  });

  it("[TC-02] Multimodal se trata como marítimo, no como aéreo", () => {
    const r = resolverTrackingCarrier({ ...base, modo: "Multimodal" });
    expect(r?.esMaritimo).toBe(true);
    expect(r?.capturaFaltante).toBe("naviera y el BL Master");
  });

  it("[TC-03] Aéreo usa aerolínea y MAWB", () => {
    const r = resolverTrackingCarrier({ ...base, modo: "Aéreo" });
    expect(r).toMatchObject({ esMaritimo: false, carrier: "AeroMéxico Cargo", referencia: "MAWB999", refLabel: "MAWB" });
  });

  it("[TC-04] Terrestre no tiene tracking de transportista", () => {
    expect(resolverTrackingCarrier({ ...base, modo: "Terrestre" })).toBeNull();
  });
});
