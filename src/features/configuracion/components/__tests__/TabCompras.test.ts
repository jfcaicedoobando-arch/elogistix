/**
 * FP-000221 — dominio del tab Compras: validación del monto máximo autorizable
 * sin liga a embarque y su valor por defecto (debe coincidir con la base).
 */
import { describe, it, expect } from "vitest";
import {
  esUmbralValido,
  UMBRAL_APROBACION_SIN_VINCULO_DEFAULT,
} from "@/features/configuracion/components/TabCompras";

describe("TabCompras (dominio)", () => {
  it("usa el mismo valor por defecto que la base (50,000 MXN)", () => {
    expect(UMBRAL_APROBACION_SIN_VINCULO_DEFAULT).toBe(50000);
  });

  it("acepta cero y montos positivos", () => {
    expect(esUmbralValido(0)).toBe(true);
    expect(esUmbralValido(250000)).toBe(true);
  });

  it("rechaza montos negativos y valores no numéricos", () => {
    expect(esUmbralValido(-1)).toBe(false);
    expect(esUmbralValido(Number.NaN)).toBe(false);
  });
});
