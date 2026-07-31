import { describe, it, expect } from "vitest";
import {
  leerSolicitudPreferencias,
  SOLICITUD_PREFS_DEFAULT,
} from "../solicitudPreferencias";

describe("solicitudPreferencias", () => {
  it("cae a los valores por defecto sin datos guardados", () => {
    expect(leerSolicitudPreferencias(null)).toEqual(SOLICITUD_PREFS_DEFAULT);
  });

  it("cae a los valores por defecto con JSON inválido", () => {
    expect(leerSolicitudPreferencias("{no-json")).toEqual(SOLICITUD_PREFS_DEFAULT);
  });

  it("respeta la última elección del cliente", () => {
    const raw = JSON.stringify({ modo: "Aéreo", tipo: "Exportación", tipoEmbarque: "LCL" });
    expect(leerSolicitudPreferencias(raw)).toEqual({
      modo: "Aéreo",
      tipo: "Exportación",
      tipoEmbarque: "LCL",
    });
  });

  it("completa campos faltantes o vacíos con el default", () => {
    const raw = JSON.stringify({ tipo: "   " });
    expect(leerSolicitudPreferencias(raw)).toEqual(SOLICITUD_PREFS_DEFAULT);
  });
});
