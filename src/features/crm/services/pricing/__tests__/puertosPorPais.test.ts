import { describe, it, expect } from "vitest";
import {
  paisesDePuertos, puertosDePais, puertoTrasCambioPais, idDeEtiqueta,
} from "../puertosPorPais";
import type { PuertoOption } from "@/features/catalogos";

const P = (id: string, code: string, name: string, country: string, activo: boolean | null = true): PuertoOption =>
  ({ id, code, name, country, activo });

const CATALOG: PuertoOption[] = [
  P("1", "CNSHA", "Shanghai", "China"),
  P("2", "CNNGB", "Ningbo", "China"),
  P("3", "MXZLO", "Manzanillo", "México"),
  P("4", "MXVER", "Veracruz", "México"),
  P("5", "USLAX", "Los Angeles", "Estados Unidos"),
  P("6", "CNOLD", "Puerto Viejo", "China", false), // inactivo
];

describe("paisesDePuertos", () => {
  it("devuelve países únicos ordenados y sin inactivos", () => {
    expect(paisesDePuertos(CATALOG)).toEqual(["China", "Estados Unidos", "México"]);
  });
  it("ignora puertos sin país", () => {
    expect(paisesDePuertos([P("1", "X", "Sin país", "")])).toEqual([]);
  });
});

describe("puertosDePais", () => {
  it("filtra por país sin distinguir mayúsculas", () => {
    expect(puertosDePais(CATALOG, "china").map((p) => p.code)).toEqual(["CNSHA", "CNNGB"]);
  });
  it("sin país devuelve lista vacía", () => {
    expect(puertosDePais(CATALOG, null)).toEqual([]);
    expect(puertosDePais(CATALOG, "")).toEqual([]);
  });
  it("excluye puertos inactivos", () => {
    expect(puertosDePais(CATALOG, "China").some((p) => p.code === "CNOLD")).toBe(false);
  });
});

describe("puertoTrasCambioPais", () => {
  const etiquetaShanghai = "Shanghai, China (CNSHA)";
  it("conserva el puerto si sigue en el país nuevo", () => {
    expect(puertoTrasCambioPais(CATALOG, "China", etiquetaShanghai)).toBe(etiquetaShanghai);
  });
  it("limpia el puerto si el país nuevo no lo contiene", () => {
    expect(puertoTrasCambioPais(CATALOG, "México", etiquetaShanghai)).toBeNull();
  });
  it("sin puerto guardado devuelve null", () => {
    expect(puertoTrasCambioPais(CATALOG, "China", null)).toBeNull();
  });
});

describe("idDeEtiqueta", () => {
  it("encuentra el id por etiqueta exacta", () => {
    expect(idDeEtiqueta(CATALOG, "Manzanillo, México (MXZLO)")).toBe("3");
  });
  it("texto libre histórico sin coincidencia devuelve vacío", () => {
    expect(idDeEtiqueta(CATALOG, "Puerto escrito a mano")).toBe("");
    expect(idDeEtiqueta(CATALOG, null)).toBe("");
  });
});
