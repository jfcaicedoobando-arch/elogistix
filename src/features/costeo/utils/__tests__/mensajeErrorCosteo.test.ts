import { describe, it, expect } from "vitest";
import { mensajeErrorCosteo, MSG_REINTENTAR } from "../mensajeErrorCosteo";
import { CosteoRutaDuplicadaError, CosteoRutaMismoPuertoError, MENSAJE_RUTA_CON_TARIFAS } from "@/features/costeo/services/rutas";
import { MENSAJE_MONEDAS_DEMORAS } from "@/features/costeo/utils/demorasTramos";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";

describe("mensajeErrorCosteo", () => {
  it("ruta duplicada muestra el motivo, no «intenta de nuevo»", () => {
    expect(mensajeErrorCosteo(new CosteoRutaDuplicadaError())).toBe(
      "Esta ruta marítima ya está registrada en tu organización.",
    );
  });

  it("origen igual a destino muestra el motivo", () => {
    expect(mensajeErrorCosteo(new CosteoRutaMismoPuertoError())).toBe(
      "El puerto de origen y el de destino deben ser distintos.",
    );
  });

  it("tabulador con monedas mezcladas muestra cómo corregirlo", () => {
    expect(mensajeErrorCosteo(new ReglaNegocioError(MENSAJE_MONEDAS_DEMORAS))).toBe(MENSAJE_MONEDAS_DEMORAS);
  });

  it("ruta con tarifas muestra el motivo", () => {
    expect(mensajeErrorCosteo(new ReglaNegocioError(MENSAJE_RUTA_CON_TARIFAS))).toBe(MENSAJE_RUTA_CON_TARIFAS);
  });

  it("un error técnico de la base sigue oculto tras el mensaje genérico", () => {
    expect(mensajeErrorCosteo(new Error("permission denied for table costeo_rutas"))).toBe(MSG_REINTENTAR);
  });
});
