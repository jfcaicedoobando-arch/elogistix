import { describe, it, expect } from "vitest";
import { destinosDeOrigen, origenesDeRutas } from "../puertosDeRutas";

const p = (id: string) => ({ id, code: id, name: id, country: "MX" });
const catalogo = [p("SHA"), p("NGB"), p("MZT"), p("LZC"), p("VER")];
const rutas = [
  { puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true },
  { puerto_origen_id: "SHA", puerto_destino_id: "LZC" },
  { puerto_origen_id: "NGB", puerto_destino_id: "VER", activa: false },
];

describe("puertosDeRutas", () => {
  it("sólo ofrece orígenes con ruta activa", () => {
    expect(origenesDeRutas(rutas, catalogo).map((x) => x.id)).toEqual(["SHA"]);
  });
  it("destinos dependen del origen elegido", () => {
    expect(destinosDeOrigen(rutas, catalogo, "SHA").map((x) => x.id)).toEqual(["MZT", "LZC"]);
  });
  it("ruta inactiva no ofrece destinos", () => {
    expect(destinosDeOrigen(rutas, catalogo, "NGB")).toEqual([]);
  });
  it("sin origen no hay destinos", () => {
    expect(destinosDeOrigen(rutas, catalogo, "")).toEqual([]);
  });
});
