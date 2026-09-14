/**
 * Regresión v13.823.366 — la UI ofrecía "Editar costos" en cotizaciones
 * Aceptadas y el guard servidor `LC_COT_COSTOS_ESTADO_INVALIDO` las rechazaba.
 */
import { describe, it, expect } from "vitest";
import { motivoBloqueoEdicionCostos } from "../estadosEditables";

describe("motivoBloqueoEdicionCostos", () => {
  it("[MC-01] permite editar en Borrador y Solicitada", () => {
    expect(motivoBloqueoEdicionCostos("Borrador")).toBeNull();
    expect(motivoBloqueoEdicionCostos("Solicitada")).toBeNull();
  });

  it("[MC-02] bloquea Aceptada y En operación guiando a Re-cotizar", () => {
    expect(motivoBloqueoEdicionCostos("Aceptada")).toMatch(/Re-cotizar/);
    expect(motivoBloqueoEdicionCostos("En operación")).toMatch(/Re-cotizar/);
  });

  it("[MC-03] bloquea estados terminales/desconocidos", () => {
    expect(motivoBloqueoEdicionCostos("Rechazada")).toMatch(/Rechazada/);
    expect(motivoBloqueoEdicionCostos(null)).toMatch(/desconocido/);
  });
});
