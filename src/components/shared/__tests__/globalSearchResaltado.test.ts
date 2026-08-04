/**
 * Tests del resaltado de coincidencias del buscador global.
 */
import { describe, it, expect } from "vitest";
import {
  resaltarCoincidencias,
  terminosBusqueda,
} from "../globalSearchResaltado";

describe("terminosBusqueda", () => {
  it("normaliza acentos y minúsculas", () => {
    expect(terminosBusqueda("Álvarez")).toEqual(["alvarez"]);
  });

  it("descarta letras sueltas pero conserva dígitos", () => {
    expect(terminosBusqueda("a 7 bl")).toEqual(["7", "bl"]);
  });

  it("elimina duplicados y separadores", () => {
    expect(terminosBusqueda("mx, mx; ex")).toEqual(["mx", "ex"]);
  });

  it("devuelve vacío con consulta vacía", () => {
    expect(terminosBusqueda("   ")).toEqual([]);
  });
});

describe("resaltarCoincidencias", () => {
  it("sin término devuelve un solo segmento sin marca", () => {
    expect(resaltarCoincidencias("EX-2026-001", "")).toEqual([
      { texto: "EX-2026-001", coincide: false },
    ]);
  });

  it("marca la coincidencia respetando el texto original", () => {
    const segs = resaltarCoincidencias("EX-2026-001", "2026");
    expect(segs).toEqual([
      { texto: "EX-", coincide: false },
      { texto: "2026", coincide: true },
      { texto: "-001", coincide: false },
    ]);
  });

  it("resalta varios términos en el mismo texto", () => {
    const segs = resaltarCoincidencias("MSCU 1234567 / Shanghai", "mscu shanghai");
    expect(segs.filter((s) => s.coincide).map((s) => s.texto)).toEqual([
      "MSCU",
      "Shanghai",
    ]);
  });

  it("ignora acentos al comparar y conserva la letra acentuada", () => {
    const segs = resaltarCoincidencias("Álvarez y Asociados", "alvarez");
    expect(segs[0]).toEqual({ texto: "Álvarez", coincide: true });
  });

  it("texto vacío no rompe", () => {
    expect(resaltarCoincidencias("", "bl")).toEqual([{ texto: "", coincide: false }]);
  });

  it("sin coincidencias devuelve el texto completo", () => {
    expect(resaltarCoincidencias("Cliente Demo", "zzz")).toEqual([
      { texto: "Cliente Demo", coincide: false },
    ]);
  });
});
