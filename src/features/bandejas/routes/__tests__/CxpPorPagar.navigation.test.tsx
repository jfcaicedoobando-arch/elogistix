import { useCallback } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { RedirectPreserveSearch } from "@/routes/RedirectPreserveSearch";
import { useVolver } from "@/hooks/shared/useVolver";
import { useCxpDeepLinks } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import CxpPorPagar from "../CxpPorPagar";

const fixture = vi.hoisted(() => ({
  rows: Array.from({ length: 12 }, (_, index) => index + 2).map((n) => ({
    factura_id: `synthetic-fp-${String(n).padStart(6, "0")}`,
    proveedor_id: "synthetic-provider", proveedor_nombre: "Proveedor sintetico",
    proveedor_origen: "agente", folio_proveedor: `FP-${String(n).padStart(6, "0")}`,
    embarque_id: null, expediente: null, fecha_emision: null, fecha_vencimiento: null,
    dias_para_vencer: n, moneda: "MXN", total: 100, pagado: 0, saldo: 100,
    estado_captura: "Aprobada", tipo_cambio_usd: null, fecha_programada_pago: null,
  })),
}));

// External reads/actions and unopened dialogs are synthetic. The imported
// Por pagar route, URL filters/pagination, responsive table and row href are real.
vi.mock("@/features/bandejas/hooks/useBandejas", () => ({
  useCxpPorPagar: () => ({ data: fixture.rows, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/cxp/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/cxp/hooks")>();
  return {
    ...actual,
    useProgramarPagoLote: () => ({ programar: vi.fn(), isRunning: false, progreso: null }),
  };
});
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canPagarProveedor: true }) }));
vi.mock("@/hooks/shared", async () => ({ useIsMobile: () => false, ...await import("@/hooks/shared/useCargaExpirada") }));
vi.mock("../_sections/CxpPorPagarDialogs", () => ({ CxpPorPagarDialogs: () => null }));

const PAY_URL = "/compras/por-pagar?q=Proveedor&moneda=MXN&vencidas=no&page=1&ps=10&sort=folio&dir=asc";
const INVOICE_URL = "/compras/facturas?q=Proveedor&page=1";
// The real deep-link hook only reads id; no service is called by this harness.
const INVOICES = fixture.rows.map((row) => ({ id: row.factura_id })) as FacturaCxP[];

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function InvoiceList() {
  const navigate = useNavigate();
  const open = useCallback((fact: FacturaCxP) => navigate(`/compras/facturas/${fact.id}`), [navigate]);
  // Keep the legacy route and real consumer mounted in the harness: the old
  // Por pagar href must reproduce its history bounce rather than hit a dead end.
  useCxpDeepLinks({ data: INVOICES, isLoading: false, onOpenDetalle: open });
  return <div data-testid="invoice-list">{fixture.rows.map((row) => (
    <Link key={row.factura_id} to={`/compras/facturas/${row.factura_id}`}>{row.folio_proveedor}</Link>
  ))}</div>;
}

function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const volver = useVolver("/compras/facturas");
  return <div data-testid="detail">{id}
    <button onClick={() => navigate(-1)}>Browser back</button>
    <button onClick={volver}>Volver</button>
  </div>;
}

function show(initial: string) {
  window.history.replaceState({ idx: 0 }, "", initial);
  render(<BrowserRouter><NuqsAdapter><Location /><Routes>
    <Route path="/compras/por-pagar" element={<CxpPorPagar />} />
    <Route path="/cxp" element={<RedirectPreserveSearch to="/compras/facturas" />} />
    <Route path="/compras/facturas" element={<InvoiceList />} />
    <Route path="/compras/facturas/:id" element={<Detail />} />
  </Routes></NuqsAdapter></BrowserRouter>);
}

async function assertBackAfterFallback(back: string, expected: string) {
  fireEvent.click(screen.getByRole("button", { name: back }));
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe(expected));
  // Use real timers and cross useVolver's 120ms fallback boundary. A transient
  // return must not pass if it subsequently redirects away or reopens detail.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
  expect(window.location.pathname + window.location.search).toBe(expected);
  expect(screen.getByTestId("location")).toHaveTextContent(expected);
  expect(fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.useRealTimers();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Navigation fixture must not access network"); }));
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("CxpPorPagar - history returns to the originating filtered page", () => {
  for (const folio of ["FP-000013", "FP-000012"]) {
    for (const back of ["Browser back", "Volver"]) {
      it(`${back} returns ${folio} to the exact Por pagar URL`, async () => {
        show(PAY_URL);
        const row = await screen.findByRole("link", { name: `Factura ${folio} de Proveedor sintetico` });
        expect(screen.queryByText("FP-000002")).not.toBeInTheDocument();
        expect(window.location.pathname + window.location.search).toBe(PAY_URL);
        fireEvent.click(row);
        const id = `synthetic-fp-${folio.slice(3)}`;
        await waitFor(() => expect(window.location.pathname).toBe(`/compras/facturas/${id}`));
        expect(screen.getByTestId("detail")).toHaveTextContent(id);
        await assertBackAfterFallback(back, PAY_URL);
        expect(screen.getByRole("link", { name: `Factura ${folio} de Proveedor sintetico` })).toBeInTheDocument();
      });
    }
  }
  for (const back of ["Browser back", "Volver"]) {
    it(`preserves ordinary Facturas history with ${back}`, async () => {
      show(INVOICE_URL);
      fireEvent.click(screen.getByRole("link", { name: "FP-000005" }));
      await waitFor(() => expect(window.location.pathname).toBe("/compras/facturas/synthetic-fp-000005"));
      await assertBackAfterFallback(back, INVOICE_URL);
      expect(screen.getByTestId("invoice-list")).toBeInTheDocument();
    });
  }
});
