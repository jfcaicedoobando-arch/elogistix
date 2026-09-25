/**
 * P2 auditoría v13.824.3 — identificador visible para borradores del agente y
 * etiqueta de ruta normalizada cuando sólo llega texto.
 */
import { describe, it, expect } from "vitest";
import { etiquetaExpedienteAgente } from "../agenteEmbarqueLabels";
import { etiquetaRutaTexto, identidadDesdeTexto } from "@/features/costeo";

describe("etiquetaExpedienteAgente", () => {
  it("usa el expediente cuando existe", () => {
    expect(etiquetaExpedienteAgente("EXP-2026-014", "f7e31d5a-1111-2222-3333-444444444444"))
      .toBe("EXP-2026-014");
  });

  it("no expone un fragmento técnico como título del borrador", () => {
    expect(etiquetaExpedienteAgente(null, "f7e31d5a-1111-2222-3333-444444444444"))
      .toBe("Borrador de embarque");
    expect(etiquetaExpedienteAgente("   ", "1bac49af-1111-2222-3333-444444444444"))
      .toBe("Borrador de embarque");
  });
});

describe("etiquetaRutaTexto", () => {
  it("no duplica país ni código cuando el texto ya los trae", () => {
    expect(etiquetaRutaTexto("Dalian, China (CNDAL)", "Ensenada, México (MXESE)"))
      .toBe("Dalian, China (CNDAL) → Ensenada, México (MXESE)");
  });

  it("degrada limpio con datos incompletos", () => {
    expect(etiquetaRutaTexto("Shanghai", "Lázaro Cárdenas"))
      .toBe("Shanghai → Lázaro Cárdenas");
    expect(etiquetaRutaTexto(null, undefined)).toBe("— → —");
  });

  it("separa nombre, país y código del texto", () => {
    expect(identidadDesdeTexto("Busan, Corea del Sur (KRPUS)")).toEqual({
      nombre: "Busan",
      country: "Corea del Sur",
      code: "KRPUS",
    });
  });
});
