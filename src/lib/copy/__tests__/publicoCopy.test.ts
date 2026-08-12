import { describe, it, expect } from "vitest";
import {
  COPY_BAJA_CORREOS,
  COPY_ENLACE,
  COPY_LEGAL,
  COPY_PIE,
  COPY_VALIDACION,
} from "@/lib/copy/publicoCopy";
import { mensajeTrackingAmigable } from "@/features/embarques/components/tracking/trackingErrorCopy";

/** Palabras en inglés que no deben aparecer en superficies públicas. */
const INGLES = /\b(powered|invalid|expired|error|failed|loading|please|success|tracking)\b/i;

const TODOS = [
  ...Object.values(COPY_ENLACE),
  ...Object.values(COPY_PIE),
  ...Object.values(COPY_BAJA_CORREOS),
  ...Object.values(COPY_LEGAL),
  COPY_VALIDACION.camposObligatorios,
  COPY_VALIDACION.motivoRechazo,
  COPY_VALIDACION.requerido("el origen"),
];

describe("publicoCopy", () => {
  it("no contiene términos en inglés", () => {
    for (const texto of TODOS) expect(texto).not.toMatch(INGLES);
  });

  it("usa trato de tú y termina con puntuación en mensajes de oración", () => {
    expect(COPY_ENLACE.invalido).toContain("Solicita");
    expect(COPY_VALIDACION.requerido("el destino")).toBe("Captura el destino para continuar.");
  });

  it("traduce los códigos técnicos del tracking al copy único", () => {
    expect(mensajeTrackingAmigable("invalid_token")).toBe(COPY_ENLACE.invalido);
    expect(mensajeTrackingAmigable("token expired")).toBe(COPY_ENLACE.invalido);
    expect(mensajeTrackingAmigable(undefined)).toBe(COPY_ENLACE.invalido);
    expect(mensajeTrackingAmigable("edge_functions_unavailable")).toBe(COPY_ENLACE.noDisponible);
  });
});
