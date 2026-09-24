import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaCxP } from "@/features/cxp/services";

const mocks = vi.hoisted(() => ({
  aprobar: vi.fn(),
  bloqueados: new Set<string>(),
}));

function factura(id: string, folio: string): FacturaCxP {
  return {
    id, folio_proveedor: folio, folio_interno: folio, proveedor_nombre: "Proveedor",
    proveedor_id: "p1", proveedor_origen: "Nacional", embarque_id: null,
    embarque_expediente: null, fecha_emision: "2026-09-01", fecha_vencimiento: "2026-09-30",
    dias_vencido: 0, moneda: "MXN", total: 1160, pagado: 0, notas_credito: 0,
    saldo: 1160, estado: "Vigente", estatus: "Vigente", tipo_cambio_usd: 1,
    estado_aprobacion: "pendiente", motivo_rechazo: null, categoria_presupuesto_id: null,
    categoria_nombre: null, subtotal: 1000, iva: 160, ieps: 0, retenciones: 0,
    rfc_proveedor: "XAXX010101000", uuid_fiscal: null, dias_credito: 30, notas: null,
    archivo_xml_url: null, archivo_pdf_url: null, uuid_verificado: false,
    uuid_verificado_fecha: null, uuid_estatus_sat: null, fecha_programada_pago: null,
    fecha_cancelacion: null, motivo_cancelacion: null, cancelada_por: null,
    created_by: "otro-usuario", flags: { parcial: false, parcialPct: 0, ncAplicada: false,
      satVerificada: false, canceladaPor: null },
  } as FacturaCxP;
}

const facturas = [factura("a", "FP-A"), factura("b", "FP-B")];

vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: vi.fn((f?: { aprobacion?: string; search?: string }) => ({
    data: f?.aprobacion === "pendiente"
      ? facturas.filter((row) => !f.search || row.folio_proveedor?.includes(f.search))
      : [],
    isLoading: false, isError: false, refetch: vi.fn(),
  })),
  useAprobarFacturasLote: () => ({ aprobar: mocks.aprobar, isRunning: false, progreso: null }),
  useVerificarSatLote: () => ({ verificar: vi.fn(), isRunning: false, progreso: null }),
  useSodAprobacion: () => ({
    idsBloqueados: (rows: FacturaCxP[]) => new Set(rows.filter((row) => mocks.bloqueados.has(row.id)).map((row) => row.id)),
    motivoBloqueo: () => "No puedes aprobar una factura capturada por ti.",
  }),
}));

vi.mock("@/hooks/shared", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  usePermissions: () => ({ canAprobarFacturaProveedor: true }),
  useFiltroUrl: <T,>(_key: string, _values: readonly T[], initial: T) => useState(initial),
  useTextoUrl: (_key: string, initial = "") => useState(initial),
  useIsMobile: () => false,
}));

import ComprasPorAprobar from "../ComprasPorAprobar";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider><MemoryRouter><ComprasPorAprobar /></MemoryRouter></TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("selección efectiva de compras por aprobar", () => {
  beforeEach(() => {
    mocks.aprobar.mockReset();
    mocks.bloqueados.clear();
  });

  it("limpia la factura seleccionada al cambiar la búsqueda y cierra el diálogo", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Seleccionar factura FP-A"));
    fireEvent.click(screen.getByRole("button", { name: "Aprobar seleccionadas (1)" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "FP-B" } });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar seleccionadas (0)" })).toBeDisabled();
    expect(mocks.aprobar).not.toHaveBeenCalled();
  });

  it("excluye una fila bloqueada por SoD del conteo y del lote", () => {
    mocks.bloqueados.add("a");
    renderPage();

    expect(screen.getByLabelText("Seleccionar factura FP-A")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aprobar seleccionadas (0)" })).toBeDisabled();
    expect(mocks.aprobar).not.toHaveBeenCalled();
  });
});