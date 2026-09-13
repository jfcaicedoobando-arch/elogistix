/**
 * Regresión v13.823.321 — el guard de "Avanzar a Confirmado" debe pedir los
 * mismos datos que el formulario marca con `*` (shipper, consignatario, ETD,
 * ETA) y los mínimos operativos por modo. Misma regla canónica que la RPC
 * `avanzar_estado_embarque` (`LC_CONFIRMADO_INCOMPLETO`).
 */
import { describe, it, expect } from "vitest";
import {
  faltantesParaConfirmado,
  clasificarAvanceError,
  faltantesDesdeErrorConfirmado,
} from "../useEmbarqueEstadoActions.helpers";

const completoMaritimo = {
  modo: "Marítimo",
  tipo_servicio: "FCL",
  peso_kg: 1200,
  naviera: "Maersk",
  bl_master: "MAEU123",
  bl_house: null,
  shipper: "Shipper Co",
  consignatario: "Consignee SA",
  etd: "2026-09-20",
  eta: "2026-10-15",
};

describe("faltantesParaConfirmado", () => {
  it("[CG-01] no reporta faltantes cuando el embarque marítimo está completo", () => {
    expect(faltantesParaConfirmado(completoMaritimo, 1)).toEqual([]);
  });

  it("[CG-02] lista shipper, consignatario, ETD y ETA cuando faltan", () => {
    const faltantes = faltantesParaConfirmado(
      { ...completoMaritimo, shipper: "", consignatario: "   ", etd: null, eta: null },
      1,
    );
    expect(faltantes).toEqual([
      "shipper (exportador)",
      "consignatario",
      "ETD",
      "ETA",
    ]);
  });

  it("[CG-03] conserva los mínimos previos (peso, naviera, BL, contenedor)", () => {
    const faltantes = faltantesParaConfirmado(
      { ...completoMaritimo, peso_kg: 0, naviera: "", bl_master: null, bl_house: null },
      0,
    );
    expect(faltantes).toEqual([
      "peso mayor a 0 kg",
      "al menos un contenedor",
      "naviera",
      "BL master u house",
    ]);
  });

  it("[CG-04] LCL no exige contenedor pero sí shipper/consignatario/ETD/ETA", () => {
    expect(
      faltantesParaConfirmado({ ...completoMaritimo, tipo_servicio: "LCL" }, 0),
    ).toEqual([]);
  });

  it("[CG-05] aéreo exige aerolínea y MAWB además de los datos comunes", () => {
    const faltantes = faltantesParaConfirmado(
      {
        modo: "Aéreo",
        peso_kg: 500,
        shipper: "S",
        consignatario: "C",
        etd: "2026-09-20",
        eta: "2026-09-22",
        aerolinea: "",
        mawb: null,
      },
      0,
    );
    expect(faltantes).toEqual(["aerolínea", "MAWB"]);
  });
});

describe("error de la RPC", () => {
  it("[CG-06] clasifica LC_CONFIRMADO_INCOMPLETO como bloqueo de captura", () => {
    expect(clasificarAvanceError("LC_CONFIRMADO_INCOMPLETO: ETD, ETA")).toBe("block_confirmado");
  });

  it("[CG-07] extrae la lista de faltantes del mensaje del servidor", () => {
    expect(
      faltantesDesdeErrorConfirmado("LC_CONFIRMADO_INCOMPLETO: shipper (exportador), ETA."),
    ).toBe("shipper (exportador), ETA");
  });

  it("[CG-08] devuelve null cuando el mensaje no trae detalle", () => {
    expect(faltantesDesdeErrorConfirmado("LC_ESTADO_CONCURRENTE: otro cambio")).toBeNull();
  });
});
