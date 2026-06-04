import { describe, expect, it } from "vitest";
import {
  filtroResponsableSchema,
  filtroRevisionSchema,
  reglaAuditoriaFiltroSchema,
  severidadFiltroSchema,
} from "../hallazgosFiltrosSchemas";

describe("hallazgosFiltrosSchemas", () => {
  it("reglaAuditoriaFiltroSchema acepta valor válido", () => {
    expect(reglaAuditoriaFiltroSchema.parse("docs_faltantes")).toBe("docs_faltantes");
    expect(reglaAuditoriaFiltroSchema.parse("todas")).toBe("todas");
  });

  it("reglaAuditoriaFiltroSchema rechaza valor inválido", () => {
    expect(() => reglaAuditoriaFiltroSchema.parse("bogus")).toThrow();
  });

  it("severidadFiltroSchema acepta criticas y todas", () => {
    expect(severidadFiltroSchema.parse("critico")).toBe("critico");
    expect(severidadFiltroSchema.parse("todas")).toBe("todas");
  });

  it("severidadFiltroSchema rechaza valor inválido", () => {
    expect(() => severidadFiltroSchema.parse("bajo")).toThrow();
  });

  it("filtroRevisionSchema acepta enumeración", () => {
    expect(filtroRevisionSchema.parse("pendientes")).toBe("pendientes");
    expect(filtroRevisionSchema.parse("en_progreso")).toBe("en_progreso");
  });

  it("filtroRevisionSchema rechaza valor inválido", () => {
    expect(() => filtroRevisionSchema.parse("x")).toThrow();
  });

  it("filtroResponsableSchema acepta enumeración", () => {
    expect(filtroResponsableSchema.parse("mios")).toBe("mios");
    expect(filtroResponsableSchema.parse("sin_asignar")).toBe("sin_asignar");
  });

  it("filtroResponsableSchema rechaza valor inválido", () => {
    expect(() => filtroResponsableSchema.parse("x")).toThrow();
  });
});
