/**
 * Etapa 2 — identidad inequívoca de puertos.
 * Pasos cubiertos:
 *  1) Rotterdam NLRTM → Veracruz MXVER se muestra sin ambigüedad.
 *  2) Campos legacy (code/country nulos) degradan limpio, sin "null" ni "()".
 *  3) La ruta China → México existente sigue formándose igual.
 *  4) El texto de búsqueda incluye nombre, país y UN/LOCODE de ambos lados.
 */
import { describe, it, expect } from "vitest";
import {
  contextoPuerto,
  contextoRuta,
  destinoDe,
  etiquetaPuertoCompleta,
  etiquetaRutaCompleta,
  nombrePuerto,
  origenDe,
  rutaCorta,
  textoBusquedaPuertos,
} from "../puertoLabel";

const ROTTERDAM = { nombre: "Rotterdam", country: "Países Bajos", code: "NLRTM" };
const VERACRUZ = { nombre: "Veracruz", country: "México", code: "MXVER" };

describe("etiquetaPuertoCompleta", () => {
  it("forma 'Nombre, País (CÓDIGO)'", () => {
    expect(etiquetaPuertoCompleta(ROTTERDAM)).toBe("Rotterdam, Países Bajos (NLRTM)");
  });

  it("sin país ni código sólo muestra el nombre", () => {
    expect(etiquetaPuertoCompleta({ nombre: "Manzanillo" })).toBe("Manzanillo");
  });

  it("legacy nulo no imprime null/undefined ni paréntesis vacíos", () => {
    const label = etiquetaPuertoCompleta({ nombre: "Shanghai", code: null, country: null });
    expect(label).toBe("Shanghai");
    expect(label).not.toMatch(/null|undefined|\(\)|,\s*$/);
  });

  it("sin nombre cae al código y si no hay nada muestra guion", () => {
    expect(etiquetaPuertoCompleta({ code: "MXZLO" })).toBe("MXZLO");
    expect(etiquetaPuertoCompleta({})).toBe("—");
    expect(nombrePuerto({})).toBe("—");
  });
});

describe("contexto y ruta", () => {
  it("contextoPuerto usa 'País · CÓDIGO' y omite faltantes", () => {
    expect(contextoPuerto(VERACRUZ)).toBe("México · MXVER");
    expect(contextoPuerto({ nombre: "Shanghai" })).toBe("");
  });

  it("etiquetaRutaCompleta identifica ambos puertos", () => {
    expect(etiquetaRutaCompleta(ROTTERDAM, VERACRUZ)).toBe(
      "Rotterdam, Países Bajos (NLRTM) → Veracruz, México (MXVER)",
    );
  });

  it("ruta China → México legacy sigue funcionando", () => {
    const shanghai = { nombre: "Shanghai", country: "China", code: "CNSHA" };
    const manzanillo = { nombre: "Manzanillo", country: "México", code: "MXZLO" };
    expect(rutaCorta(shanghai, manzanillo)).toBe("Shanghai → Manzanillo");
    expect(contextoRuta(shanghai, manzanillo)).toBe("China · CNSHA → México · MXZLO");
  });

  it("contextoRuta vacío cuando ningún lado aporta datos", () => {
    expect(contextoRuta({ nombre: "A" }, { nombre: "B" })).toBe("");
  });
});

describe("origenDe / destinoDe / textoBusquedaPuertos", () => {
  const fila = {
    puerto_origen_nombre: "Rotterdam",
    puerto_origen_code: "NLRTM",
    puerto_origen_country: "Países Bajos",
    puerto_destino_nombre: "Veracruz",
    puerto_destino_code: "MXVER",
    puerto_destino_country: "México",
  };

  it("extrae identidades desde la fila", () => {
    expect(origenDe(fila)).toEqual(ROTTERDAM);
    expect(destinoDe(fila)).toEqual(VERACRUZ);
  });

  it("permite buscar por nombre, país o código", () => {
    const hay = textoBusquedaPuertos(fila);
    for (const q of ["rotterdam", "países bajos", "nlrtm", "mxver", "méxico"]) {
      expect(hay.includes(q)).toBe(true);
    }
  });
});
