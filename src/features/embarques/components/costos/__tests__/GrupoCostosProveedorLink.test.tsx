/**
 * La columna "Factura(s)" del tab Costos debe mostrar el folio interno de
 * Libre Carga (FP-XXXXXX) y llevar a la factura de proveedor al hacer clic.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GrupoCostosProveedor } from "../GrupoCostosProveedor";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";

function fila(folioInterno: string | null): FilaReconciliacion {
  return {
    concepto_costo_id: "cc-1",
    concepto: "Cargos Destino",
    proveedor_nombre: "WAN HAI",
    moneda: "USD",
    cotizado: 60,
    real_facturado: 60,
    diferencia: 0,
    desviacion_pct: 0,
    estado_liquidacion: "Pendiente",
    estatus_renglon: "conciliado",
    facturas: [
      {
        proveedor_factura_id: "70e4b713-153f-4c9e-b908-a238989a914f",
        folio_interno: folioInterno,
        folio_proveedor: "034G545923",
        fecha_emision: "2026-09-10",
        fecha_vencimiento: null,
        estatus_pago: "Vigente",
        descripcion: null,
        monto: 60,
      },
    ],
  };
}

function renderGrupo(folioInterno: string | null) {
  return render(
    <MemoryRouter>
      <GrupoCostosProveedor proveedorNombre="WAN HAI" filas={[fila(folioInterno)]} />
    </MemoryRouter>,
  );
}

describe("GrupoCostosProveedor · enlace a la factura", () => {
  it("muestra el folio interno y enlaza al detalle de la factura", () => {
    renderGrupo("FP-000256");
    const link = screen.getByRole("link", { name: /Abrir factura FP-000256/i });
    expect(link).toHaveAttribute(
      "href",
      "/compras/facturas/70e4b713-153f-4c9e-b908-a238989a914f",
    );
    expect(link).toHaveTextContent("FP-000256");
  });

  it("cae al folio del proveedor cuando no hay folio interno", () => {
    renderGrupo(null);
    expect(
      screen.getByRole("link", { name: /Abrir factura 034G545923/i }),
    ).toBeInTheDocument();
  });
});
