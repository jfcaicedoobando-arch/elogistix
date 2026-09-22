/**
 * Etapa 5 · helpers puros de la ruta en la solicitud del portal.
 */
import { describe, expect, it } from "vitest";
import {
  esModoMaritimoSolicitud,
  idsSolicitudPersistibles,
  placeholderRuta,
} from "../solicitudRuta";

describe("solicitudRuta", () => {
  it("sólo reconoce Marítimo como modo con identidad de puerto", () => {
    expect(esModoMaritimoSolicitud("Marítimo")).toBe(true);
    expect(esModoMaritimoSolicitud("Aéreo")).toBe(false);
  });

  it("conserva los IDs en Marítimo", () => {
    expect(
      idsSolicitudPersistibles({ modo: "Marítimo", puertoOrigenId: "a", puertoDestinoId: "b" }),
    ).toEqual({ puertoOrigenId: "a", puertoDestinoId: "b" });
  });

  it("fuerza NULL fuera de Marítimo", () => {
    for (const modo of ["Aéreo", "Terrestre", "Multimodal"] as const) {
      expect(
        idsSolicitudPersistibles({ modo, puertoOrigenId: "a", puertoDestinoId: "b" }),
      ).toEqual({ puertoOrigenId: null, puertoDestinoId: null });
    }
  });

  it("nunca envía el mismo ID en ambos extremos", () => {
    expect(
      idsSolicitudPersistibles({ modo: "Marítimo", puertoOrigenId: "a", puertoDestinoId: "a" }),
    ).toEqual({ puertoOrigenId: "a", puertoDestinoId: null });
  });

  it("permite un extremo de catálogo y otro libre", () => {
    expect(
      idsSolicitudPersistibles({ modo: "Marítimo", puertoOrigenId: null, puertoDestinoId: "b" }),
    ).toEqual({ puertoOrigenId: null, puertoDestinoId: "b" });
  });

  it("usa placeholders genéricos por modo (sin ejemplos sesgados)", () => {
    expect(placeholderRuta("Marítimo", "origen")).toBe("Busca o escribe puerto de origen");
    expect(placeholderRuta("Aéreo", "destino")).toBe("Ciudad, aeropuerto o terminal de destino");
    expect(placeholderRuta("Marítimo", "origen")).not.toMatch(/China|México/);
  });
});
