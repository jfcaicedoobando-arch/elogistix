import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PagoDetalle, RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { BotonVerPago } from "../BotonVerPago";
import { DetallePagoSheet } from "../DetallePagoSheet";

const { detalle } = vi.hoisted(() => ({ detalle: vi.fn() }));
vi.mock("@/features/tesoreria/hooks/usePagoDetalle", () => ({ usePagoDetalle: detalle }));

function fixture(estado: string): PagoDetalle {
  return {
    tipo: "anticipo", movimiento: null, aplicaciones: [],
    pago: {
      id: "anticipo-fixture", tipo: "anticipo", fecha: "2026-10-03", contraparte: "Proveedor de prueba",
      contraparte_id: null, moneda: "MXN", monto: 25, tipo_cambio: null, monto_mxn: 25,
      metodo_pago: "Efectivo", referencia: "fixture-22", cuenta_bancaria_id: null, cuenta_alias: null,
      cuenta_banco: null, notas: null, embarque_id: null, diferencia_cambiaria_mxn: 0, estado_rep: null,
      folio_rep: null, es_ajuste: false, lote_id: null, estado, saldo_disponible: 25, created_by: null, created_at: null,
    },
  };
}

function DesdeConciliacion() {
  const [ref, setRef] = useState<RefPago | null>(null);
  return <>
    <BotonVerPago movimiento={{ estado_conciliacion: "Conciliado", anticipo_proveedor_id: "anticipo-fixture" }} onVerPago={setRef} />
    <DetallePagoSheet ref_pago={ref} onOpenChange={(open) => { if (!open) setRef(null); }} />
  </>;
}

describe("Ver pago del anticipo desde Conciliación", () => {
  it.each([
    ["disponible", "Disponible"],
    ["aplicado_parcial", "Aplicado parcial"],
    ["aplicado_total", "Aplicado total"],
    ["cancelado", "Cancelado"],
  ])("muestra %s con etiqueta %s y conserva el enum y el importe", (estado, etiqueta) => {
    const data = fixture(estado);
    detalle.mockImplementation((ref: RefPago | null) => ({
      data: ref ? data : undefined, isLoading: false, isError: false, error: null, refetch: vi.fn(),
    }));
    render(<MemoryRouter><TooltipProvider><DesdeConciliacion /></TooltipProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Ver pago" }));
    expect(detalle).toHaveBeenLastCalledWith({ tipo: "anticipo", id: "anticipo-fixture" });
    const etiquetaVisible = screen.getByText(etiqueta);
    expect(etiquetaVisible.closest("[data-domain]")).toHaveAttribute("data-domain", "anticipo_proveedor");
    expect(etiquetaVisible.closest("[data-status]")).toHaveAttribute("data-status", estado);
    expect(screen.queryByText(estado, { exact: true })).not.toBeInTheDocument();
    expect(data.pago.monto).toBe(25);
    expect(screen.getByText("Anticipo a proveedor")).toBeInTheDocument();
  });
});
