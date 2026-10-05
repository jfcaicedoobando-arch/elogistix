import { describe, expect, it } from "vitest";
import { varianteEstadoEmpresa } from "../estadoEmpresaVisual";

describe("presentación del estado de empresas CRM", () => {
  it.each([
    ["Lead", "outline"], ["Sospechoso", "outline"],
    ["Prospecto", "default"], ["Cliente", "secondary"],
  ] as const)("conserva %s como %s", (estado, variante) => {
    expect(varianteEstadoEmpresa(estado)).toBe(variante);
  });
});
