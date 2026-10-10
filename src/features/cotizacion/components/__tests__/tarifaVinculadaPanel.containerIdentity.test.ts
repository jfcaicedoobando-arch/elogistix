import { describe, expect, it, vi } from "vitest";
import { computeTarifaWarnings, resolveTipoContenedorId } from "../tarifaVinculadaPanel.helpers";

// Aísla el barrel de UI; la normalización importada sigue siendo la real.
vi.mock("@/features/catalogos", async () => {
  const { claveIdentidadCatalogo } = await import("@/features/catalogos/utils/tiposContenedorCanonico");
  return { claveIdentidadCatalogo };
});

const HC = "11111111-1111-4111-8111-111111111111";
const HC_LEGACY = "22222222-2222-4222-8222-222222222222";
const DRY = "33333333-3333-4333-8333-333333333333";
const catalogo = [
  { id: HC, name: "40' High Cube", code: "40HC", idsEquivalentes: [HC, HC_LEGACY] },
  { id: DRY, name: "20' Dry", code: "20DRY", idsEquivalentes: [DRY] },
];
const tarifa = { tipo_contenedor_id: HC_LEGACY, vigente_hasta: "2026-12-31" };

describe("GUI69: identidad de contenedor de tarifa", () => {
  it.each([HC, HC_LEGACY, "40' High Cube", "40HC", " 40hc ", "40 High Cube"])(
    "resuelve %s al ID canónico", (valor) => {
      expect(resolveTipoContenedorId(valor, catalogo)).toBe(HC);
    },
  );

  it.each([HC, HC_LEGACY, "40' High Cube", "40HC"])(
    "no avisa por una representación equivalente: %s", (valor) => {
      expect(computeTarifaWarnings(tarifa, null, valor, catalogo).tipoMismatch).toBe(false);
    },
  );

  it.each([DRY, "20' Dry", "20DRY", "Contenedor no catalogado"])(
    "no oculta una discrepancia real: %s", (valor) => {
      expect(computeTarifaWarnings(tarifa, null, valor, catalogo).tipoMismatch).toBe(true);
    },
  );

  it("no compara un nombre contra UUID mientras falta el catálogo", () => {
    expect(computeTarifaWarnings(tarifa, null, "40' High Cube", []).tipoMismatch).toBe(false);
  });

  it("vacío y tarifa ausente no generan aviso", () => {
    expect(computeTarifaWarnings(tarifa, null, "", catalogo).tipoMismatch).toBe(false);
    expect(computeTarifaWarnings(null, null, HC, catalogo).tipoMismatch).toBe(false);
  });

  it("conserva la comprobación de vigencia y el contrato sin catálogo", () => {
    expect(computeTarifaWarnings(tarifa, new Date(2027, 0, 1), HC_LEGACY)).toEqual({
      vencidaAntesDeValidez: true, tipoMismatch: false,
    });
    expect(computeTarifaWarnings(tarifa, null, DRY).tipoMismatch).toBe(true);
  });

  it.each([
    ["40' Dry", "40' Dry (Standard)", "40DV"],
    ["20' Dry", "20 Estándar", "20ST"],
  ])("resuelve el nombre histórico %s a su identidad del catálogo", (valor, name, code) => {
    const tipos = [{ id: DRY, name, code }];
    expect(resolveTipoContenedorId(valor, tipos)).toBe(DRY);
    expect(computeTarifaWarnings({ ...tarifa, tipo_contenedor_id: DRY }, null, valor, tipos).tipoMismatch).toBe(false);
  });

  it("no confunde la identidad GP con Dry ni 20 con 40 pies", () => {
    const tipos = [{ id: DRY, code: "20GP", name: "20' GP" }];
    expect(resolveTipoContenedorId("20' Dry", tipos)).toBeUndefined();
    expect(resolveTipoContenedorId("40' GP", tipos)).toBeUndefined();
    expect(computeTarifaWarnings({ ...tarifa, tipo_contenedor_id: DRY }, null, "20' Dry", tipos).tipoMismatch).toBe(true);
  });
});
