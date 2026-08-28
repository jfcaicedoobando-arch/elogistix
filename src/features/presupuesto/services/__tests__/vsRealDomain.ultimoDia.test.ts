/**
 * N27 (Ola E2 · B) — `ultimoDia` debe ser puro y estable en cualquier zona
 * horaria: antes creaba un Date local y lo leía en UTC, corriendo el día.
 */
import { describe, it, expect } from "vitest";
import { ultimoDia } from "@/features/presupuesto/services/vsRealDomain";

describe("ultimoDia", () => {
  it("devuelve el último día de meses de 31 y 30 días", () => {
    expect(ultimoDia("2026-01")).toBe("2026-01-31");
    expect(ultimoDia("2026-04")).toBe("2026-04-30");
    expect(ultimoDia("2026-12")).toBe("2026-12-31");
  });

  it("maneja febrero bisiesto y no bisiesto", () => {
    expect(ultimoDia("2026-02")).toBe("2026-02-28");
    expect(ultimoDia("2028-02")).toBe("2028-02-29");
    expect(ultimoDia("2100-02")).toBe("2100-02-28");
    expect(ultimoDia("2000-02")).toBe("2000-02-29");
  });

  it("mantiene el formato con dos dígitos en el mes", () => {
    expect(ultimoDia("2026-09")).toBe("2026-09-30");
  });
});
