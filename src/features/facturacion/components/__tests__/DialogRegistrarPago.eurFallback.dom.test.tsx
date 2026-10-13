/** Local QA: real DOM/FX normalization/submit hook; all persistence and REP I/O mocked. */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DialogRegistrarPago } from "../DialogRegistrarPago";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), mutateAsync: vi.fn(), emitirRep: vi.fn(), saldo: 1,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/features/catalogos/services", async () => await import("@/features/catalogos/services/exchangeRates"));
vi.mock("@/features/catalogos/hooks", async () => await import("@/features/catalogos/hooks/useExchangeRates"));
vi.mock("@/features/facturacion/hooks", () => ({
  usePagosFactura: () => ({ data: [] }),
  useRegistrarPagoFactura: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("@/features/facturacion/hooks/useSaldoFactura", () => ({
  useNotasCreditoAplicadas: () => ({ data: [] }), useSaldoFacturaServidor: () => ({ data: mocks.saldo }),
}));
vi.mock("@/features/facturacion/services/repFacturapi", () => ({ emitirRep: mocks.emitirRep, esRepYaTimbrado: () => false }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn(), notifyInfo: vi.fn() }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-10-12" }));

const missingEur = { usdMxn: 18.4163, eurMxn: null, es_fallback: false, eur_es_fallback: true };
// Synthetic IDs. Values reproduce only the read-only fixture's sandbox EUR invoice shape.
const factura = { id: "qa-eur-fixture", numero: "QA-EUR", total: 1, moneda: "EUR", metodoPago: "PPD", estado: "Vencida", fechaEmision: "2026-10-05", uuidFiscal: "qa-mocked-uuid" };
const guardar = () => screen.getByRole("button", { name: "Registrar pago" });
const tc = () => screen.getByLabelText("Tipo de cambio del pago");
const monto = (value: string) => fireEvent.change(screen.getByLabelText("Monto del pago"), { target: { value } });
const manual = (value: string) => fireEvent.change(tc(), { target: { value } });
const enviarForm = () => fireEvent.submit(screen.getByLabelText("Monto del pago").closest("form")!);
async function moneda(value: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Moneda" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: value, exact: true }));
}
function montar(monedaFactura = "EUR", total = 1) {
  mocks.saldo = total;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const onClose = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(true);
    return <QueryClientProvider client={qc}><TooltipProvider>
      <button type="button" onClick={() => setOpen(true)}>Reabrir</button>
      <DialogRegistrarPago open={open} factura={{ ...factura, moneda: monedaFactura, total }} onOpenChange={(v) => { onClose(v); setOpen(v); }} />
    </TooltipProvider></QueryClientProvider>;
  }
  render(<Harness />);
  return { qc, onClose };
}
async function esperarRespaldo() {
  expect(await screen.findByText("Tipo de cambio de respaldo.")).toBeInTheDocument();
  expect(guardar()).toBeDisabled();
}
beforeEach(() => {
  mocks.invoke.mockResolvedValue({ data: missingEur, error: null });
  mocks.mutateAsync.mockResolvedValue({ pagoId: "qa-pago", movimientoBancario: "omitido" });
  mocks.emitirRep.mockResolvedValue({ status: "timbrado" });
});

const pares = [
  { pago: "EUR", factura: "EUR", total: 1, monto: "1", aplicado: 1 },
  { pago: "EUR", factura: "MXN", total: 100, monto: "1", aplicado: 21 },
  { pago: "MXN", factura: "EUR", total: 1, monto: "21", aplicado: 1 },
];

describe("EUR ausente: integración DOM de Registrar pago", () => {
  it.each(pares)("bloquea botón y handler $pago → $factura; TC manual permite sólo el importe correcto", async (par) => {
    montar(par.factura, par.total);
    if (par.pago !== par.factura) await moneda(par.pago);
    monto(par.monto);
    await esperarRespaldo();
    expect(tc()).toHaveValue("18.5");
    expect(tc()).not.toHaveValue("18.4163");
    expect(screen.queryByText(/Equivalente:/)).not.toBeInTheDocument();
    fireEvent.click(guardar());
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.emitirRep).not.toHaveBeenCalled();
    manual("21");
    expect(guardar()).toBeEnabled();
    expect(screen.queryByText("Tipo de cambio de respaldo.")).not.toBeInTheDocument();
    fireEvent.click(guardar());
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      moneda: par.pago, monto: Number(par.monto), tipo_cambio: 21, monto_aplicado_factura: par.aplicado,
    }));
    await waitFor(() => expect(mocks.emitirRep).toHaveBeenCalledExactlyOnceWith("qa-pago"));
  });

  it.each(["4.9999", "40.0001"])("rechaza TC manual fuera de banda %s incluso vía submit directo", async (value) => {
    montar();
    await esperarRespaldo();
    manual(value);
    expect(screen.getByText("El tipo de cambio debe estar entre 5 y 40.")).toBeInTheDocument();
    expect(guardar()).toBeDisabled();
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.emitirRep).not.toHaveBeenCalled();
  });

  it.each(["5", "40"])("acepta límite inclusivo manual %s", async (value) => {
    montar();
    await esperarRespaldo();
    manual(value);
    expect(guardar()).toBeEnabled();
    enviarForm();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tipo_cambio: Number(value), monto_aplicado_factura: 1 })));
  });

  it("Usar DOF o borrar TC vuelve a bloquear; reabrir no conserva un TC manual", async () => {
    montar();
    await esperarRespaldo();
    manual("21");
    fireEvent.click(screen.getByRole("button", { name: "Usar DOF" }));
    await esperarRespaldo();
    manual("22");
    manual("");
    await esperarRespaldo();
    manual("23");
    fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "QA reopening" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await esperarRespaldo();
    expect(tc()).toHaveValue("18.5");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("cambiar moneda elimina TC manual y conserva el bloqueo en MXN → EUR", async () => {
    montar();
    await esperarRespaldo();
    manual("21");
    await moneda("MXN");
    monto("21");
    await esperarRespaldo();
    expect(tc()).toHaveValue("18.5");
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("acepta EUR fiable recibido después de la respuesta sin EUR", async () => {
    const { qc } = montar();
    await esperarRespaldo();
    mocks.invoke.mockResolvedValue({ data: { ...missingEur, eurMxn: 20.6419, eur_es_fallback: false }, error: null });
    await act(async () => { await qc.invalidateQueries(); });
    await waitFor(() => expect(tc()).toHaveValue("20.6419"));
    expect(guardar()).toBeEnabled();
    enviarForm();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tipo_cambio: 20.6419, monto_aplicado_factura: 1 })));
  });

  it.each(["USD", "MXN"])("EUR ausente no bloquea el control %s misma moneda", async (divisa) => {
    montar(divisa);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalled());
    await waitFor(() => expect(guardar()).toBeEnabled());
    enviarForm();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ moneda: divisa, tipo_cambio: divisa === "USD" ? 18.4163 : 1 })));
  });

  it.each(pares)("no convierte foco/blur sin captura en TC manual: $pago → $factura", async (par) => {
    montar(par.factura, par.total);
    if (par.pago !== par.factura) await moneda(par.pago);
    monto(par.pago === "MXN" ? "18.5" : "1");
    await esperarRespaldo();
    act(() => (tc() as HTMLInputElement).focus());
    act(() => (tc() as HTMLInputElement).blur());
    expect.soft(guardar()).toBeDisabled();
    await act(async () => { enviarForm(); });
    expect.soft(mocks.mutateAsync).not.toHaveBeenCalled();
    expect.soft(mocks.emitirRep).not.toHaveBeenCalled();
  });
});


describe("TC manual: edición explícita y reinicio de procedencia", () => {
  function enfocarYSalir() {
    act(() => (tc() as HTMLInputElement).focus());
    act(() => (tc() as HTMLInputElement).blur());
  }

  it.each(pares)("permite teclear explícitamente el mismo número estimado y normalizar: $pago → $factura", async (par) => {
    montar(par.factura, par.total);
    if (par.pago !== par.factura) await moneda(par.pago);
    const importe = par.pago === "MXN" ? "18.5" : "1";
    monto(importe);
    await esperarRespaldo();
    act(() => (tc() as HTMLInputElement).focus());
    manual("");
    manual("18.50");
    act(() => (tc() as HTMLInputElement).blur());
    expect(tc()).toHaveValue("18.5");
    expect(guardar()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Usar DOF" })).toBeInTheDocument();
    enviarForm();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      moneda: par.pago, monto: Number(importe), tipo_cambio: 18.5,
      monto_aplicado_factura: par.factura === "MXN" ? 18.5 : 1,
    })));
    await waitFor(() => expect(mocks.emitirRep).toHaveBeenCalledExactlyOnceWith("qa-pago"));
  });

  it("mantiene bloqueo tras Usar DOF, borrar y reabrir aunque se repita foco/blur", async () => {
    montar();
    await esperarRespaldo();
    manual("21");
    enfocarYSalir();
    expect(guardar()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Usar DOF" }));
    enfocarYSalir();
    enfocarYSalir();
    await esperarRespaldo();
    expect(screen.queryByRole("button", { name: "Usar DOF" })).not.toBeInTheDocument();
    manual("22");
    manual("");
    enfocarYSalir();
    await esperarRespaldo();
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    manual("23");
    fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "QA reopening" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    enfocarYSalir();
    await esperarRespaldo();
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.emitirRep).not.toHaveBeenCalled();
  });

  it("cambiar moneda y salir del TC no recupera la captura de la moneda anterior", async () => {
    montar();
    await esperarRespaldo();
    manual("21");
    enfocarYSalir();
    await moneda("MXN");
    monto("21");
    enfocarYSalir();
    await esperarRespaldo();
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.emitirRep).not.toHaveBeenCalled();
  });

  it("un TC fiable enfocado no queda fijado como manual si el refetch pierde EUR", async () => {
    mocks.invoke.mockResolvedValue({ data: { ...missingEur, eurMxn: 20.6419, eur_es_fallback: false }, error: null });
    const { qc } = montar();
    await waitFor(() => expect(tc()).toHaveValue("20.6419"));
    expect(guardar()).toBeEnabled();
    enfocarYSalir();
    expect(screen.queryByRole("button", { name: "Usar DOF" })).not.toBeInTheDocument();
    mocks.invoke.mockResolvedValue({ data: missingEur, error: null });
    await act(async () => { await qc.invalidateQueries(); });
    enfocarYSalir();
    await esperarRespaldo();
    expect(tc()).toHaveValue("18.5");
    enviarForm();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.emitirRep).not.toHaveBeenCalled();
  });

  it.each([
    { pago: "USD", factura: "MXN", monto: "1", aplicado: 18.4163 },
    { pago: "MXN", factura: "USD", monto: "18.4163", aplicado: 1 },
  ])("conserva TC USD fiable y conversión tras blur: $pago → $factura", async (par) => {
    montar(par.factura, 100);
    await moneda(par.pago);
    monto(par.monto);
    await waitFor(() => expect(tc()).toHaveValue("18.4163"));
    enfocarYSalir();
    expect(guardar()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Usar DOF" })).not.toBeInTheDocument();
    enviarForm();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      moneda: par.pago, monto: Number(par.monto), tipo_cambio: 18.4163, monto_aplicado_factura: par.aplicado,
    })));
    await waitFor(() => expect(mocks.emitirRep).toHaveBeenCalledExactlyOnceWith("qa-pago"));
  });
});
