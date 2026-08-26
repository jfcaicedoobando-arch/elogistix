import { describe, it, expect } from "vitest";
import {
  LC_CONFLICTO_CONCURRENCIA,
  conflictoConcurrenciaError,
  esConflictoConcurrencia,
} from "../concurrencia";

describe("bloqueo optimista (N-06)", () => {
  it("el error trae el código LC y un mensaje accionable", () => {
    const e = conflictoConcurrenciaError();
    expect(e.message).toContain(LC_CONFLICTO_CONCURRENCIA);
    expect(e.message).toContain("Recarga la página");
  });

  it("esConflictoConcurrencia distingue otros errores", () => {
    expect(esConflictoConcurrencia(conflictoConcurrenciaError())).toBe(true);
    expect(esConflictoConcurrencia(new Error("otro"))).toBe(false);
    expect(esConflictoConcurrencia(null)).toBe(false);
  });
});
