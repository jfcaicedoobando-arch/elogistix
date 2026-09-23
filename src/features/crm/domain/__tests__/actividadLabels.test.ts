import { describe, expect, it } from "vitest";
import {
  ACTIVIDAD_ENTIDAD_LABEL,
  ACTIVIDAD_TIPO_LABEL,
  actividadTipoVariant,
} from "../actividadLabels";

describe("actividadLabels", () => {
  it("presenta tipos y entidades con rótulos humanos", () => {
    expect(ACTIVIDAD_TIPO_LABEL.llamada).toBe("Llamada");
    expect(ACTIVIDAD_TIPO_LABEL.tarea).toBe("Tarea");
    expect(ACTIVIDAD_TIPO_LABEL.nota).toBe("Nota");
    expect(ACTIVIDAD_ENTIDAD_LABEL.lead).toBe("Lead");
    expect(ACTIVIDAD_ENTIDAD_LABEL.oportunidad).toBe("Oportunidad");
  });

  it("reserva tonos de atención para actividades accionables", () => {
    expect(actividadTipoVariant("tarea")).toBe("warning");
    expect(actividadTipoVariant("nota")).toBe("neutral");
  });
});