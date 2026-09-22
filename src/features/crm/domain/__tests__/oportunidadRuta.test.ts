/**
 * Etapa 4 · helpers de ruta de oportunidad: normalización del modo legacy,
 * transiciones de modo/puerto y IDs persistibles.
 */
import { describe, it, expect } from "vitest";
import {
  aplicarCambioModo,
  aplicarCambioPuerto,
  esModoMaritimo,
  idsPuertoPersistibles,
  normalizarModoOportunidad,
  type RutaOportunidad,
} from "../oportunidadRuta";

const base: RutaOportunidad = {
  modo: "Marítimo",
  origen: "Shanghai, China (CNSHA)",
  destino: "Manzanillo, México (MXZLO)",
  puerto_origen_id: "p-sha",
  puerto_destino_id: "p-zlo",
};

describe("normalizarModoOportunidad", () => {
  it("normaliza variantes legacy reconocibles", () => {
    expect(normalizarModoOportunidad("Maritimo").valor).toBe("Marítimo");
    expect(normalizarModoOportunidad("Marítimo FCL").valor).toBe("Marítimo");
    expect(normalizarModoOportunidad("Aereo consolidado").valor).toBe("Aéreo");
  });

  it("modo vacío no genera advertencia (la oportunidad no se bloquea)", () => {
    expect(normalizarModoOportunidad("")).toEqual({ valor: "", advertencia: null });
    expect(normalizarModoOportunidad(null).advertencia).toBeNull();
  });

  it("texto no reconocible se conserva con advertencia accionable", () => {
    const r = normalizarModoOportunidad("FCL");
    expect(r.valor).toBe("FCL");
    expect(r.advertencia).toMatch(/no corresponde/i);
  });
});

describe("aplicarCambioModo", () => {
  it("conserva IDs en Marítimo (incluidas variantes)", () => {
    expect(aplicarCambioModo(base, "Marítimo FCL").puerto_origen_id).toBe("p-sha");
    expect(esModoMaritimo("Maritimo")).toBe(true);
  });

  it("limpia IDs al salir de Marítimo y conserva el texto", () => {
    const r = aplicarCambioModo(base, "Aéreo");
    expect(r).toMatchObject({
      modo: "Aéreo",
      origen: base.origen,
      destino: base.destino,
      puerto_origen_id: null,
      puerto_destino_id: null,
    });
  });
});

describe("aplicarCambioPuerto", () => {
  it("guarda texto + ID de catálogo de forma atómica", () => {
    const r = aplicarCambioPuerto(
      { ...base, origen: "", puerto_origen_id: null },
      "origen",
      "Rotterdam, Países Bajos (NLRTM)",
      "p-rtm",
    );
    expect(r.origen).toBe("Rotterdam, Países Bajos (NLRTM)");
    expect(r.puerto_origen_id).toBe("p-rtm");
  });

  it("texto libre guarda ID null sin tocar el otro extremo", () => {
    const r = aplicarCambioPuerto(base, "destino", "Manzillo", null);
    expect(r.destino).toBe("Manzillo");
    expect(r.puerto_destino_id).toBeNull();
    expect(r.puerto_origen_id).toBe("p-sha");
  });

  it("origen = destino nunca queda persistible: limpia el otro ID", () => {
    const r = aplicarCambioPuerto(base, "origen", "Manzanillo, México (MXZLO)", "p-zlo");
    expect(r.puerto_origen_id).toBe("p-zlo");
    expect(r.puerto_destino_id).toBeNull();
    const r2 = aplicarCambioPuerto(base, "destino", "Shanghai, China (CNSHA)", "p-sha");
    expect(r2.puerto_destino_id).toBe("p-sha");
    expect(r2.puerto_origen_id).toBeNull();
  });
});

describe("idsPuertoPersistibles", () => {
  it("Marítimo persiste ambos IDs", () => {
    expect(idsPuertoPersistibles(base)).toEqual({
      puerto_origen_id: "p-sha",
      puerto_destino_id: "p-zlo",
    });
  });

  it("modos no marítimos fuerzan NULL", () => {
    for (const modo of ["Aéreo", "Terrestre", "Multimodal", "", "FCL"]) {
      expect(idsPuertoPersistibles({ ...base, modo })).toEqual({
        puerto_origen_id: null,
        puerto_destino_id: null,
      });
    }
  });

  it("defensa final: IDs iguales no se persisten iguales", () => {
    expect(
      idsPuertoPersistibles({ ...base, puerto_destino_id: "p-sha" }),
    ).toEqual({ puerto_origen_id: "p-sha", puerto_destino_id: null });
  });
});
