import { describe, expect, it } from "vitest";
import { agingVencidoBucket, agingPorCobrarBucket } from "../aging";

describe("agingVencidoBucket", () => {
  it("clasifica 1-30 días como warning suave", () => {
    expect(agingVencidoBucket(10).className).toContain("bg-warning/60");
  });
  it("clasifica 31-60 días como warning fuerte", () => {
    expect(agingVencidoBucket(45).className).toBe("bg-warning text-warning-foreground");
  });
  it("clasifica 61-90 días como destructive suave", () => {
    expect(agingVencidoBucket(75).className).toContain("bg-destructive/70");
  });
  it("clasifica 90+ días como destructive fuerte", () => {
    expect(agingVencidoBucket(120).className).toBe("bg-destructive text-destructive-foreground");
  });
});

describe("agingPorCobrarBucket", () => {
  it("marca 'Vence hoy' cuando dias_vencido = 0", () => {
    expect(agingPorCobrarBucket(0).label).toBe("Vence hoy");
  });
  it("usa warning suave si faltan 1-7 días", () => {
    expect(agingPorCobrarBucket(-5).className).toContain("bg-warning/60");
  });
  it("usa muted cuando falta más de una semana", () => {
    expect(agingPorCobrarBucket(-30).className).toContain("bg-muted");
  });
});
