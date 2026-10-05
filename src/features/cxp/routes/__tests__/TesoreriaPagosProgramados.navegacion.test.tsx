import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DocumentoTabs } from "@/components/shared/documento/DocumentoTabs";
import { FacturaProveedorHeader } from "../../components/detalle/FacturaProveedorHeader";
import { InfoFacturaSection } from "../../components/InfoFacturaSection";
import type { FacturaCxP } from "@/features/cxp/services";
import TesoreriaPagosProgramados from "@/features/tesoreria/routes/TesoreriaPagosProgramados";

const mocks = vi.hoisted(() => ({ programar: vi.fn(), pagar: vi.fn(), verificar: vi.fn() }));
vi.mock("@/features/tesoreria/services/pagosProgramados", () => ({ fetchPagosProgramables: async () => facturas }));
vi.mock("@/features/tesoreria/hooks/useTesoreriaCuentas", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("@/features/tesoreria/hooks/useEjecutarPagoProgramado", () => ({ useEjecutarPagoProgramado: () => ({ mutateAsync: mocks.pagar, isPending: false }) }));
vi.mock("@/features/cxp/hooks/useProgramarPagoProveedor", () => ({ useProgramarPagoProveedor: () => ({ mutate: mocks.programar, isPending: false }) }));
vi.mock("@/features/cxp/hooks/useVerificarUuidSat", () => ({ useVerificarUuidSat: () => ({ mutate: mocks.verificar, isPending: false }) }));

function factura(id: string, over: Partial<FacturaCxP> = {}): FacturaCxP {
  return {
    id, proveedor_id: "proveedor", proveedor_nombre: `Proveedor ${id}`, proveedor_origen: "Nacional",
    embarque_id: null, embarque_expediente: null, folio_proveedor: id, folio_interno: id,
    fecha_emision: "2026-10-03", fecha_vencimiento: null, dias_vencido: 0,
    moneda: "USD", total: 116, pagado: 0, notas_credito: 100, saldo: 16, estado: "Vigente", estatus: "Vigente",
    tipo_cambio_usd: 20, estado_aprobacion: "aprobada", motivo_rechazo: null,
    categoria_presupuesto_id: null, categoria_nombre: null, subtotal: 100, iva: 16, ieps: 0, retenciones: 0,
    rfc_proveedor: null, uuid_fiscal: null, dias_credito: null, notas: null,
    archivo_xml_url: null, archivo_pdf_url: null, uuid_verificado: false, uuid_verificado_fecha: null,
    uuid_estatus_sat: null, fecha_programada_pago: null, fecha_cancelacion: null,
    motivo_cancelacion: null, cancelada_por: null, created_by: null,
    flags: { parcial: false, parcialPct: 0, ncAplicada: true, satVerificada: false, canceladaPor: null },
    ...over,
  };
}
const facturas = [factura("FP8"), factura("FP12"), factura("FP-pendiente", { estado_aprobacion: "pendiente" })];

function Destino() {
  const { id } = useParams();
  const f = facturas.find((r) => r.id === id)!;
  return <>
    <FacturaProveedorHeader factura={f} />
    <DocumentoTabs tabs={[
      { id: "conceptos", label: "Conceptos", content: <p>Conceptos fiscales</p> },
      { id: "fiscal", label: "Proveedor y datos fiscales", content: <InfoFacturaSection factura={f} /> },
    ]} />
  </>;
}
function RutaActual() {
  const location = useLocation();
  return <output data-testid="ruta">{location.pathname + location.search + location.hash}</output>;
}
function montar(url = "/tesoreria/pagos-programados?origen=revision") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><TooltipProvider><MemoryRouter initialEntries={[url]}>
    <RutaActual />
    <Routes>
      <Route path="/tesoreria/pagos-programados" element={<TesoreriaPagosProgramados />} />
      <Route path="/compras/facturas/:id" element={<Destino />} />
    </Routes>
  </MemoryRouter></TooltipProvider></QueryClientProvider>);
}

describe("56: Programar pago abre la fecha en datos fiscales y conserva el origen", () => {
  it.each(["FP8", "FP12"])("%s llega a fiscal, enfoca la fecha y vuelve a Tesorería", async (id) => {
    montar();
    const botones = await screen.findAllByRole("button", { name: "Programar pago" });
    fireEvent.click(botones[id === "FP8" ? 0 : 1]);
    expect(screen.getByTestId("ruta")).toHaveTextContent(`/compras/facturas/${id}?tab=fiscal#programacion-pago`);
    expect(screen.getByRole("tab", { name: "Proveedor y datos fiscales" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Fecha programada de pago")).toHaveFocus();
    const volver = screen.getByRole("link", { name: "Volver a Pagos programados" });
    expect(volver).toHaveAttribute("href", "/tesoreria/pagos-programados?origen=revision");
    fireEvent.click(volver);
    await waitFor(() => expect(screen.getByTestId("ruta")).toHaveTextContent("/tesoreria/pagos-programados?origen=revision"));
    expect(mocks.programar).not.toHaveBeenCalled();
    expect(mocks.pagar).not.toHaveBeenCalled();
  });

  it("revisar aprobación abre datos fiscales sin enfocar la programación", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Revisar aprobación" }));
    expect(screen.getByTestId("ruta")).toHaveTextContent("/compras/facturas/FP-pendiente?tab=fiscal");
    expect(screen.getByLabelText("Fecha programada de pago")).not.toHaveFocus();
  });

  it("un enlace fiscal directo sin origen conserva el retorno a Compras", () => {
    montar("/compras/facturas/FP12?tab=fiscal");
    expect(screen.getByRole("link", { name: "Volver a Facturas de proveedor" })).toHaveAttribute("href", "/compras/facturas");
    expect(screen.getByLabelText("Fecha programada de pago")).not.toHaveFocus();
  });
});
