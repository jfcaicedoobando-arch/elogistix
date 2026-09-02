/**
 * v13.823.31 — Una factura de proveedor extranjero / captura manual no depende
 * del SAT mexicano: es seleccionable y aprobable, y no cuenta para "Validar en
 * SAT". Una factura nacional con CFDI sí cuenta.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FacturaCxP } from "@/features/cxp/services";

function factura(over: Partial<FacturaCxP>): FacturaCxP {
  return {
    id: "f1", proveedor_id: "p1", proveedor_nombre: "CHINO EL AGENTE",
    proveedor_origen: "Extranjero", embarque_id: null, embarque_expediente: null,
    folio_proveedor: "QA-CODEX-FP-001", folio_interno: "FP-000001",
    fecha_emision: "2026-09-01", fecha_vencimiento: "2026-09-30", dias_vencido: 0,
    moneda: "MXN", total: 1160, pagado: 0, notas_credito: 0, saldo: 1160,
    estado: "Vigente", estatus: "Vigente", tipo_cambio_usd: 1,
    estado_aprobacion: "pendiente", motivo_rechazo: null,
    categoria_presupuesto_id: null, categoria_nombre: null,
    subtotal: 1000, iva: 160, ieps: 0, retenciones: 0,
    rfc_proveedor: null, uuid_fiscal: null, dias_credito: 30, notas: null,
    archivo_xml_url: null, archivo_pdf_url: null,
    uuid_verificado: false, uuid_verificado_fecha: null, uuid_estatus_sat: null,
    fecha_programada_pago: null, fecha_cancelacion: null, motivo_cancelacion: null,
    cancelada_por: null, created_by: "otro-usuario",
    flags: { parcial: false, parcialPct: 0, ncAplicada: false, satVerificada: false, canceladaPor: null },
    ...over,
  } as FacturaCxP;
}

const extranjera = factura({});
const nacionalCfdi = factura({
  id: "f2", folio_proveedor: "QA-CODEX-FP-002", proveedor_origen: "Nacional",
  uuid_fiscal: "11111111-1111-1111-1111-111111111111",
});

vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: vi.fn((f?: { aprobacion?: string }) => ({
    data: f?.aprobacion === "pendiente" ? [extranjera, nacionalCfdi] : [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    kpis: {},
  })),
  useAprobarFacturasLote: () => ({ aprobar: vi.fn(), isRunning: false, progreso: null }),
  useVerificarSatLote: () => ({ verificar: vi.fn(), isRunning: false, progreso: null }),
  useSodAprobacion: () => ({ idsBloqueados: () => new Set<string>(), motivoBloqueo: () => null }),
}));
vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canEdit: true, canAprobarFacturaProveedor: true }),
  useFiltroUrl: <T,>(_c: string, _v: readonly T[], def: T) => [def, vi.fn()],
  useTextoUrl: (_c: string, def = "") => [def, vi.fn()],
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import ComprasPorAprobar from "../ComprasPorAprobar";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/compras/por-aprobar"]}>
        <ComprasPorAprobar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("<ComprasPorAprobar /> · SAT no aplica", () => {
  it("la factura extranjera manual es seleccionable (checkbox habilitado)", () => {
    renderPage();
    const cb = screen.getByLabelText("Seleccionar factura QA-CODEX-FP-001");
    expect(cb).not.toBeDisabled();
  });

  it("muestra el chip 'SAT: No aplica' para la extranjera y no para el CFDI nacional", () => {
    renderPage();
    expect(screen.getAllByText("SAT: No aplica")).toHaveLength(1);
  });

  it("el botón de SAT arranca en 0 (sin selección) y las acciones existen", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Validar en SAT \(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aprobar seleccionadas \(0\)/ })).toBeInTheDocument();
  });
});
