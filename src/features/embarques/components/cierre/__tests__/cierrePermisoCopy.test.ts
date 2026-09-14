import { describe, expect, it } from "vitest";
import { CIERRE_PERMISO_COPY, CIERRE_RESTRINGIDO_COPY } from "../cierrePermisoCopy";

describe("mensajes de permiso de cierre", () => {
  it("menciona operaciones y administración sin atribuirlo a finanzas", () => {
    for (const mensaje of [CIERRE_PERMISO_COPY, CIERRE_RESTRINGIDO_COPY]) {
      expect(mensaje).toMatch(/coordinación.*gerencia de operaciones.*administración/i);
      expect(mensaje).not.toMatch(/finanzas/i);
    }
  });
});