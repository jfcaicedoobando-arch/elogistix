import { describe, expect, it } from "vitest";
import { calcularMontoDestinoTraspaso, validarMontoDestinoTraspaso } from "../traspasoForm";

describe("59 · abono a centavos, igual que ROUND numeric de PostgreSQL", () => {
  it.each([
    [0.01, 1 / 18.1903, 0],
    [0.10, 1 / 18.1903, 0.01],
    [0.01, 18.1903, 0.18],
    [0.01, 0.5, 0.01],
    [0.01, 0.4999, 0],
    [10.075, 1, 10.08],
  ])("monto%s por factor%s abona%s", (monto, factor, esperado) => {
    expect(calcularMontoDestinoTraspaso(monto, factor)).toBe(esperado);
    expect(validarMontoDestinoTraspaso(monto, factor) === null).toBe(esperado > 0);
  });
});
