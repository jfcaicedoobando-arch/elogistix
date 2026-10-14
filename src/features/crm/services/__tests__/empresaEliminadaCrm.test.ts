import { describe, expect, it } from "vitest";
import { oportunidadesConEmpresaEliminada } from "../empresaEliminadaCrm";

describe("oportunidadesConEmpresaEliminada", () => {
  it("marca la oportunidad cuya única empresa fue eliminada", () => {
    expect(oportunidadesConEmpresaEliminada([{ oportunidad_id: "o1", eliminada: true }]).has("o1")).toBe(true);
  });
  it("no marca si todavía tiene otra empresa activa", () => {
    const r = oportunidadesConEmpresaEliminada([
      { oportunidad_id: "o1", eliminada: true }, { oportunidad_id: "o1", eliminada: false },
    ]);
    expect(r.has("o1")).toBe(false);
  });
  it("no marca oportunidades con empresa activa", () => {
    expect(oportunidadesConEmpresaEliminada([{ oportunidad_id: "o2", eliminada: false }]).size).toBe(0);
  });
});
