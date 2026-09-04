/**
 * Regresión de copy: singular/plural en contadores de oportunidades.
 */
import { describe, expect, it } from "vitest";
import { copiaContadorOportunidades, copiaOportunidadesAbiertas } from "../oportunidadesContadorCopy";

describe("copy de contadores de oportunidades", () => {
  it("usa singular con un solo registro", () => {
    expect(copiaContadorOportunidades(1, 1)).toBe("1 de 1 oportunidad");
    expect(copiaOportunidadesAbiertas(1)).toBe("1 oportunidad abierta");
  });

  it("conserva plural en 0 y N>1", () => {
    expect(copiaContadorOportunidades(0, 0)).toBe("0 de 0 oportunidades");
    expect(copiaContadorOportunidades(2, 5)).toBe("2 de 5 oportunidades");
    expect(copiaOportunidadesAbiertas(0)).toBe("0 oportunidades abiertas");
    expect(copiaOportunidadesAbiertas(3)).toBe("3 oportunidades abiertas");
  });
});
