import { describe, expect, it } from "vitest";
import { puedeAsignarCoordinador } from "../coordinadorAsignacion";

describe("puedeAsignarCoordinador", () => {
  it("permite gerente de operaciones y administradores", () => {
    expect(puedeAsignarCoordinador("gerente_operaciones")).toBe(true);
    expect(puedeAsignarCoordinador("admin")).toBe(true);
    expect(puedeAsignarCoordinador("admin_org")).toBe(true);
  });
  it("bloquea vendedor, coordinador y sin sesión", () => {
    expect(puedeAsignarCoordinador("vendedor")).toBe(false);
    expect(puedeAsignarCoordinador("coordinador_logistico")).toBe(false);
    expect(puedeAsignarCoordinador(null)).toBe(false);
  });
});
