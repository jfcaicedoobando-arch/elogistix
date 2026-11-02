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
  it("destinos dependen del origen elegido sin invertir la ruta", () => {
    expect(destinosDeOrigen(rutas, catalogo, "SHA").map((x) => x.id)).toEqual(["MZT", "LZC"]);
    expect(destinosDeOrigen(rutas, catalogo, "MZT")).toEqual([]);
  });
  it("ruta inactiva no ofrece destinos", () => {
    expect(destinosDeOrigen(rutas, catalogo, "NGB")).toEqual([]);
  });
  it("sin origen no hay destinos", () => {
    expect(destinosDeOrigen(rutas, catalogo, "")).toEqual([]);
  });

  it("conserva como activas las rutas con activa null o sin especificar", () => {
    const registradas = [
      { puerto_origen_id: "NGB", puerto_destino_id: "VER", activa: null },
      { puerto_origen_id: "SHA", puerto_destino_id: "MZT" },
    ];
    expect(origenesDeRutas(registradas, catalogo).map((x) => x.id)).toEqual(["SHA", "NGB"]);
    expect(destinosDeOrigen(registradas, catalogo, "NGB").map((x) => x.id)).toEqual(["VER"]);
    expect(destinosDeOrigen(registradas, catalogo, "SHA").map((x) => x.id)).toEqual(["MZT"]);
  });

  it("devuelve opciones vacías sin rutas o sin catálogo", () => {
    expect(origenesDeRutas([], catalogo)).toEqual([]);
    expect(destinosDeOrigen([], catalogo, "SHA")).toEqual([]);
    expect(origenesDeRutas(rutas, [])).toEqual([]);
    expect(destinosDeOrigen(rutas, [], "SHA")).toEqual([]);
  });

  it("excluye referencias fuera del catálogo sin exigir un destino conocido al origen", () => {
    const registradas = [
      { puerto_origen_id: "DESCONOCIDO", puerto_destino_id: "VER", activa: true },
      { puerto_origen_id: "SHA", puerto_destino_id: "DESCONOCIDO", activa: true },
    ];
    expect(origenesDeRutas(registradas, catalogo).map((x) => x.id)).toEqual(["SHA"]);
    expect(destinosDeOrigen(registradas, catalogo, "SHA")).toEqual([]);
    expect(destinosDeOrigen(registradas, catalogo, "SIN_RUTA")).toEqual([]);
  });

  it("deduplica rutas y conserva el orden del catálogo para ambos selectores", () => {
    const ordenado = [p("VER"), p("LZC"), p("SHA"), p("MZT"), p("NGB")];
    const registradas = [
      { puerto_origen_id: "NGB", puerto_destino_id: "VER", activa: true },
      { puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true },
      { puerto_origen_id: "SHA", puerto_destino_id: "LZC", activa: true },
      { puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true },
      { puerto_origen_id: "NGB", puerto_destino_id: "VER", activa: true },
    ];
    expect(origenesDeRutas(registradas, ordenado)).toEqual([ordenado[2], ordenado[4]]);
    expect(destinosDeOrigen(registradas, ordenado, "SHA")).toEqual([ordenado[1], ordenado[3]]);
  });
});
