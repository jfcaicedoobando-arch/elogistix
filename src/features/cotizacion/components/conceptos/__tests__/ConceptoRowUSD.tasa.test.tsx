/**
 * P1 · Auditoría IVA — el renglón USD resolvía su tasa con fallback 0, así que
 * un concepto `gravado_16` mostraba 0% en el selector mientras el total de la
 * misma línea ya venía con 16%. Ahora usa la tasa de la organización, igual que
 * el hook que calcula el total.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConceptoRowUSD } from "@/features/cotizacion/components/conceptos/ConceptoRowUSD";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";

vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: () => <div data-testid="catalogo" />,
}));

vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => false,
}));

vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <div data-testid="unidad" />,
}));

const base = {
  descripcion: "Flete internacional",
  unidad_medida: "E48",
  cantidad: 1,
  precio_unitario: 1000,
  total: 1160,
  aplica_iva: true,
} as ConceptoVentaCotizacion;

function renderRow(concepto: ConceptoVentaCotizacion, actualizar = vi.fn()) {
  render(
    <ConceptoRowUSD
      concepto={concepto}
      index={0}
      total={1}
      actualizar={actualizar}
      eliminar={vi.fn()}
      tasaIva={0.16}
    />,
  );
  return actualizar;
}

describe("ConceptoRowUSD · tasa mostrada vs. tasa calculada", () => {
  it("una fila gravada al 16% muestra 16%, no 0%", () => {
    renderRow({ ...base, tipo_iva: "gravado_16" });
    expect(screen.getByText("16%")).toBeInTheDocument();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("una fila legacy sin clasificar pide definir el tratamiento, no muestra 0%", () => {
    renderRow({ ...base, tipo_iva: undefined, tasa_iva_aplicada: undefined });
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.getByText(/por definir/i)).toBeInTheDocument();
  });

  it("una fila de frontera muestra 8% (su propia tasa, no la global)", () => {
    renderRow({ ...base, tipo_iva: "gravado_8" });
    expect(screen.getByText("8%")).toBeInTheDocument();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("una fila a tasa 0% sigue mostrando 0%: la tasa global no la pisa", () => {
    renderRow({ ...base, tipo_iva: "tasa_0" });
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("16%")).toBeNull();
  });
});
