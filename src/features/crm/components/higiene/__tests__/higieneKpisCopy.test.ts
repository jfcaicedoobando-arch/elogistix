import { describe, it, expect } from "vitest";
import { copiaOportunidadesCompletas } from "../higieneKpisCopy";

describe("copiaOportunidadesCompletas", () => {
  it("usa singular cuando hay exactamente una oportunidad abierta", () => {
    expect(copiaOportunidadesCompletas(1, 1)).toBe("1 de 1 oportunidad completa");
  });

  it("usa plural para cero oportunidades abiertas", () => {
    expect(copiaOportunidadesCompletas(0, 0)).toBe("0 de 0 oportunidades completas");
  });

  it("usa plural para varias oportunidades abiertas", () => {
    expect(copiaOportunidadesCompletas(2, 3)).toBe("2 de 3 oportunidades completas");
    expect(copiaOportunidadesCompletas(1, 5)).toBe("1 de 5 oportunidades completas");
  });
});
