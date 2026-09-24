import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { GrupoCostosProveedor } from "../GrupoCostosProveedor";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";

vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => ({ canViewFinancials: true, canViewCosts: true }),
}));

function fila(overrides: Partial<FilaReconciliacion> = {}): FilaReconciliacion {
  return {
    concepto_costo_id: "costo-1", concepto: "Flete marítimo", proveedor_nombre: "Naviera",
    moneda: "USD", cotizado: 100, real_facturado: 0, diferencia: -100,
    desviacion_pct: -100, estado_liquidacion: "Pendiente", estatus_renglon: "sin_match",
    facturas: [], ...overrides,
  };
}

function renderGrupo(row: FilaReconciliacion, contenedor = false) {
  render(
    <MemoryRouter>
      <GrupoCostosProveedor
        proveedorNombre="Naviera"
        filas={[row]}
        showContenedorCol={contenedor}
        filaContenedorId={() => "cont-1"}
        renderContenedor={(id) => id === "cont-1" ? "MSCU1234567" : "General"}
      />
    </MemoryRouter>,
  );
}

describe("GrupoCostosMobileRows", () => {
  it("distingue cotizado de ausencia de factura también frente a desktop", () => {
    renderGrupo(fila());
    const mobile = screen.getByRole("list");
    expect(within(mobile).getByText("Cotizado")).toBeInTheDocument();
    expect(within(mobile).getByText("Facturado")).toBeInTheDocument();
    expect(within(mobile).getAllByText("Sin factura").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/100\.00/)).toHaveLength(2);
  });

  it("muestra facturación parcial, ajuste y contenedor sin mezclar monedas", () => {
    renderGrupo(fila({
      real_facturado: 40, diferencia: -60, desviacion_pct: -60, estatus_renglon: "parcial",
      facturas: [{
        proveedor_factura_id: "fact-1", folio_interno: "FP-000001", folio_proveedor: "EXT-1",
        fecha_emision: null, fecha_vencimiento: null, estatus_pago: "Vigente", descripcion: null, monto: 40,
      }],
    }), true);
    const mobile = screen.getByRole("list");
    expect(within(mobile).getByText(/40\.00/)).toHaveTextContent("USD");
    expect(within(mobile).getByText("MSCU1234567")).toBeInTheDocument();
    expect(within(mobile).getByText("Factura(s)")).toBeInTheDocument();
    expect(screen.getAllByText("MSCU1234567")).toHaveLength(2);
  });
});