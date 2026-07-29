import { describe, it, expect } from "vitest";
import { isValidUuid, isValidTopTarifasIds } from "../useTopTarifas";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("useTopTarifas — validación de UUIDs (Q-03)", () => {
  it("isValidUuid acepta un UUID bien formado", () => {
    expect(isValidUuid(UUID)).toBe(true);
  });

  it("isValidUuid rechaza undefined, null, vacío y texto libre", () => {
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("Shanghai, China (CNSHA)")).toBe(false);
  });

  it("isValidTopTarifasIds requiere los 3 ids como UUID válido", () => {
    expect(
      isValidTopTarifasIds({
        puertoOrigenId: UUID,
        puertoDestinoId: UUID,
        tipoContenedorId: UUID,
      }),
    ).toBe(true);
  });

  it("isValidTopTarifasIds es false si falta cualquiera de los 3 ids", () => {
    expect(isValidTopTarifasIds({ puertoOrigenId: UUID, puertoDestinoId: UUID })).toBe(false);
    expect(
      isValidTopTarifasIds({ puertoOrigenId: "", puertoDestinoId: UUID, tipoContenedorId: UUID }),
    ).toBe(false);
    expect(
      isValidTopTarifasIds({
        puertoOrigenId: "texto libre",
        puertoDestinoId: UUID,
        tipoContenedorId: UUID,
      }),
    ).toBe(false);
  });
});
