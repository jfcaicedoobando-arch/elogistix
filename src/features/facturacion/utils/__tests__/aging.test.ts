import { describe, expect, it } from "vitest";
import { agingVencidoBucket, agingPorCobrarBucket } from "../aging";
import { AGING_SOLID_CLASS } from "@/lib/aging/buckets";

describe("agingVencidoBucket", () => {
  it("usa la escala única de aging por cubeta", () => {
    expect(agingVencidoBucket(10).className).toBe(AGING_SOLID_CLASS[2]);
    expect(agingVencidoBucket(45).className).toBe(AGING_SOLID_CLASS[3]);
    expect(agingVencidoBucket(75).className).toBe(AGING_SOLID_CLASS[4]);
    expect(agingVencidoBucket(120).className).toBe(AGING_SOLID_CLASS[5]);
  });
});

describe("agingPorCobrarBucket", () => {
  it("marca 'Vence hoy' cuando dias_vencido = 0", () => {
    expect(agingPorCobrarBucket(0).label).toBe("Vence hoy");
  });
  it("usa el nivel más suave si faltan 1-7 días", () => {
    expect(agingPorCobrarBucket(-5).className).toBe(AGING_SOLID_CLASS[1]);
    expect(agingPorCobrarBucket(-5).label).toBe("5 d");
  });
  it("usa muted cuando falta más de una semana", () => {
    expect(agingPorCobrarBucket(-30).className).toContain("bg-muted");
    expect(agingPorCobrarBucket(-10).label).toBe("10 d");
  });
  it("fallback destructivo si llega un valor positivo (ya vencida)", () => {
    const b = agingPorCobrarBucket(3);
    expect(b.className).toBe(AGING_SOLID_CLASS[2]);
    expect(b.label).toBe("3 d");
    expect(b.ariaLabel).toContain("Venció hace 3");
  });
});
