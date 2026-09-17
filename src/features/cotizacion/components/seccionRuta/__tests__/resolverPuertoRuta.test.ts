/**
 * CRM-P2.5 — el CRM guarda la ruta puerta a puerta en un solo texto
 * ("Puerto de Manzanillo → Parque Industrial Apodaca"). La búsqueda de tarifa
 * debe resolver el puerto desde ese texto SIN que el usuario lo vuelva a
 * elegir y sin sobrescribir el destino final.
 */
import { describe, it, expect } from "vitest";
import { resolverPuertoId, segmentosRuta } from "../resolverCatalogos";

const PUERTOS = [
  { id: "p-mzn", name: "Manzanillo", country: "México", code: "MXZLO" },
  { id: "p-sha", name: "Shanghai", country: "China", code: "CNSHA" },
];

describe("resolverPuertoId · rutas puerta a puerta", () => {
  it("resuelve el puerto dentro de un destino puerta a puerta", () => {
    expect(
      resolverPuertoId("Puerto de Manzanillo → Parque Industrial Apodaca", PUERTOS),
    ).toBe("p-mzn");
  });

  it("acepta otros separadores y el prefijo sin acento", () => {
    expect(resolverPuertoId("Manzanillo -> Apodaca, NL", PUERTOS)).toBe("p-mzn");
    expect(resolverPuertoId("Terminal de Shanghai | Bodega", PUERTOS)).toBe("p-sha");
  });

  it("sigue resolviendo los valores simples de siempre", () => {
    expect(resolverPuertoId("Manzanillo, México (MXZLO)", PUERTOS)).toBe("p-mzn");
    expect(resolverPuertoId("CNSHA", PUERTOS)).toBe("p-sha");
    expect(resolverPuertoId("p-mzn", PUERTOS)).toBe("p-mzn");
  });

  it("no adivina: un texto sin puerto conocido no resuelve", () => {
    expect(resolverPuertoId("Parque Industrial Apodaca", PUERTOS)).toBeUndefined();
    expect(resolverPuertoId("", PUERTOS)).toBeUndefined();
  });

  it("segmentosRuta separa y limpia prefijos sin perder el original", () => {
    expect(segmentosRuta("Puerto de Manzanillo → Apodaca")).toEqual([
      "Puerto de Manzanillo",
      "Apodaca",
      "Manzanillo",
    ]);
  });
});
