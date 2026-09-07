import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProformaHeader } from "../ProformaHeader";
import { makeProforma, makeEmbarque } from "@/test/fixtures";

const proforma = makeProforma({ numero: "P-CONT", expediente: "EXP-1" });

function renderHeader(contenedores: unknown) {
  const embarque = makeEmbarque({ modo: "Terrestre", tipo: "Importación" });
  return render(
    <ProformaHeader
      proforma={proforma}
      cliente={null}
      embarque={{ ...embarque, contenedores } as typeof embarque}
      esConsolidada={false}
    />,
  ).container.textContent ?? "";
}

/** R184-PDF-02: el rótulo "Contenedores" sólo aparece con datos presentables. */
describe("ProformaHeader · bloque Contenedores (R184-PDF-02)", () => {
  it("omite el bloque cuando no hay contenedores", () => {
    expect(renderHeader([])).not.toContain("Contenedores");
  });

  it("omite el bloque cuando los contenedores no tienen número ni tipo", () => {
    const texto = renderHeader([
      { id: "a", numero_contenedor: "", tipo_contenedor: "" },
      { id: "b", numero_contenedor: "   ", tipo_contenedor: null },
    ]);
    expect(texto).not.toContain("Contenedores");
  });

  it("muestra sólo los contenedores presentables cuando se mezclan con vacíos", () => {
    const texto = renderHeader([
      { id: "a", numero_contenedor: "  ", tipo_contenedor: "" },
      { id: "b", numero_contenedor: "MSCU1234567", tipo_contenedor: "40HC" },
    ]);
    expect(texto).toContain("Contenedores");
    expect(texto).toContain("MSCU1234567");
    expect(texto).toContain("40HC");
  });

  it("conserva contenedores reales en transporte terrestre", () => {
    const texto = renderHeader([{ id: "c", numero_contenedor: "TERR0001", tipo_contenedor: null }]);
    expect(texto).toContain("TERR0001");
  });
});
