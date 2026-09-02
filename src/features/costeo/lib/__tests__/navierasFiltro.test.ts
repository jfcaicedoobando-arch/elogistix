import { describe, it, expect } from "vitest";
import { filtrarNavieras, normalizarBusquedaNaviera } from "../navierasFiltro";

const filas = [
  { naviera_nombre: "Maersk", condicion: { id: "1" } },
  { naviera_nombre: "MSC Mediterranean", condicion: null },
  { naviera_nombre: "Hapag-Lloyd", condicion: null },
];

describe("normalizarBusquedaNaviera", () => {
  it("ignora acentos y mayúsculas", () => {
    expect(normalizarBusquedaNaviera("Móvil  ")).toBe("movil");
  });
});

describe("filtrarNavieras", () => {
  it("filtra por nombre normalizado", () => {
    expect(filtrarNavieras(filas, "hapag", "todos")).toHaveLength(1);
  });

  it("filtra configuradas", () => {
    expect(filtrarNavieras(filas, "", "configuradas")).toEqual([filas[0]]);
  });

  it("filtra sin configurar", () => {
    expect(filtrarNavieras(filas, "", "sin_configurar")).toHaveLength(2);
  });

  it("sin filtros devuelve todo", () => {
    expect(filtrarNavieras(filas, "", "todos")).toHaveLength(3);
  });
});
