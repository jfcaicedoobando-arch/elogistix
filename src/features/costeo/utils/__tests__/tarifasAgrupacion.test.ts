import { describe, it, expect } from "vitest";
import { buildGruposTarifas, esTarifaElegible, type FilaAgrupable } from "../tarifasAgrupacion";

const TODAY = "2026-07-29";

function fila(overrides: Partial<FilaAgrupable> = {}): FilaAgrupable {
  return {
    puerto_origen_nombre: "MZT",
    puerto_destino_nombre: "SHA",
    tipo_contenedor_nombre: "40HC",
    agente_nombre: "Agente A",
    total_comparable: 1000,
    vigente_hasta: "2026-12-31",
    estado: "activa",
    estado_aprobacion: "vigente",
    ...overrides,
  };
}

describe("esTarifaElegible", () => {
  it("tarifa en borrador de aprobación NO es elegible aunque sea la más barata", () => {
    expect(esTarifaElegible(fila({ estado_aprobacion: "borrador" }), TODAY)).toBe(false);
  });

  it("estado_aprobacion undefined se trata como vigente (legacy)", () => {
    expect(esTarifaElegible(fila({ estado_aprobacion: undefined }), TODAY)).toBe(true);
  });

  it("vigente_hasta < today excluye", () => {
    expect(esTarifaElegible(fila({ vigente_hasta: "2020-01-01" }), TODAY)).toBe(false);
  });

  it("estado reemplazada excluye", () => {
    expect(esTarifaElegible(fila({ estado: "reemplazada" }), TODAY)).toBe(false);
  });
});

describe("buildGruposTarifas", () => {
  it("con 0/1 elegibles, promedio/deltaMax quedan null", () => {
    const grupos = buildGruposTarifas([fila({ total_comparable: 900 })], TODAY);
    expect(grupos[0].elegiblesCount).toBe(1);
    expect(grupos[0].promedio).toBeNull();
    expect(grupos[0].deltaMax).toBeNull();
  });

  it("mejor es la elegible de menor total_comparable", () => {
    const grupos = buildGruposTarifas(
      [
        fila({ total_comparable: 1200, agente_nombre: "B" }),
        fila({ total_comparable: 900, agente_nombre: "A" }),
        fila({ total_comparable: 800, estado_aprobacion: "borrador", agente_nombre: "C" }),
      ],
      TODAY,
    );
    expect(grupos[0].mejor?.total_comparable).toBe(900);
    expect(grupos[0].elegiblesCount).toBe(2);
    expect(grupos[0].promedio).toBe(1050);
    expect(grupos[0].deltaMax).toBe(300);
  });
});
