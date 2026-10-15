import { describe, it, expect } from "vitest";
import { oportunidadesConSolicitudRespondida } from "../solicitudRespondidaCrm";

describe("etiqueta Solicitud respondida", () => {
  it("aparece con una solicitud respondida", () => {
    expect(oportunidadesConSolicitudRespondida([{ oportunidad_id: "a", estado: "respondida" }]).has("a")).toBe(true);
  });
  it("no aparece si otra solicitud sigue enviada", () => {
    expect(oportunidadesConSolicitudRespondida([
      { oportunidad_id: "a", estado: "respondida" }, { oportunidad_id: "a", estado: "enviada" },
    ]).has("a")).toBe(false);
  });
  it("no aparece con solo canceladas", () => {
    expect(oportunidadesConSolicitudRespondida([{ oportunidad_id: "a", estado: "cancelada" }]).size).toBe(0);
  });
});
