import { describe, it, expect, vi, afterEach } from "vitest";
import { confirmarAjustesGrapa, textoConfirmacionAjustes } from "../confirmarAjustesGrapa";

const ajuste = { descripcion: "Flete Marítimo", monto: 6540, original: 6485, facturado: 13025 };

describe("confirmarAjustesGrapa", () => {
  afterEach(() => vi.restoreAllMocks());

  it("muestra el detalle con el monto de la diferencia", () => {
    const t = textoConfirmacionAjustes([ajuste], "USD");
    expect(t).toContain("Flete Marítimo");
    expect(t).toContain("6,540.00");
  });

  it("si el usuario rechaza, no se agrega", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(confirmarAjustesGrapa([ajuste], "USD")).toBe(false);
  });

  it("sin notas no pregunta", () => {
    const spy = vi.spyOn(window, "confirm");
    expect(confirmarAjustesGrapa([], "USD")).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
