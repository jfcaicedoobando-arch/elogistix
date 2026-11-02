import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MovimientoBBVA, SugerenciasResultado } from "../../domain/conciliacionTypes";

const { leerCandidatos, mutar } = vi.hoisted(() => ({ leerCandidatos: vi.fn(), mutar: vi.fn() }));
vi.mock("@/features/tesoreria/services", () => ({
  sugerirCandidatosDetalle: leerCandidatos, esMovimientoManual: () => false,
}));
vi.mock("@/lib/query", () => ({ queryKeys: { tesoreria: { candidatos: (id: string | null) => ["candidatos-h20", id] } } }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useMutationWithFeedback: vi.fn() }));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canCapturarMovimientoBancario: false }) }));
vi.mock("@/components/shared/FormDialogShell", () => ({ FormDialogShell: () => null }));
vi.mock("@/features/tesoreria/components/DetallePagoSheet", () => ({ DetallePagoSheet: () => null }));
vi.mock("@/features/tesoreria/hooks", async () => {
  const { useSugerirCandidatos } = await import("../../hooks/useTesoreriaMovimientos");
  const mutation = () => ({ mutate: mutar, isPending: false });
  return {
    useSugerirCandidatos, useConciliarPago: mutation, useIgnorarMovimiento: mutation,
    useDesconciliar: mutation, useEliminarMovimientoManual: mutation,
  };
});

import { PanelConciliacionMovimiento } from "../PanelConciliacionMovimiento";

const movimiento: MovimientoBBVA = {
  id: "mov-ficticio", cuenta_bancaria_id: "cuenta-ficticia", organization_id: "org-ficticia",
  fecha: "2026-11-01", concepto: "Movimiento de prueba", referencia: "PRUEBA", cargo: 0, abono: 100,
  saldo: null, hash_dedupe: "prueba", origen: "estado_cuenta", estado_conciliacion: "Pendiente",
  pago_factura_id: null, pago_factura_lote_id: null, pago_proveedor_id: null,
  pago_proveedor_lote_id: null, anticipo_proveedor_id: null, traspaso_id: null,
  conciliado_at: null, conciliado_por: null, motivo_ignorar: "", importado_en: "2026-11-01T12:00:00Z",
  importado_por: null, deleted_at: null, deleted_by: null,
};
const resultado: SugerenciasResultado = {
  candidatos: [{ tipo: "cxc", pago_id: "pago-ficticio", fecha: "2026-11-01", referencia: "PRUEBA",
    monto: 100, moneda: "MXN", contraparte: "Cliente de prueba", delta_dias: 0, delta_monto: 0 }],
  truncado: false,
};
let client: QueryClient;

function montar(mov = movimiento) {
  return render(<QueryClientProvider client={client}>
    <PanelConciliacionMovimiento movimiento={mov} onClose={vi.fn()} />
  </QueryClientProvider>);
}

beforeEach(() => {
  leerCandidatos.mockReset();
  mutar.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => {
  expect(mutar).not.toHaveBeenCalled();
  client.clear();
});

describe("candidatos de conciliación: lectura y recuperación", () => {
  it("durante la primera carga no afirma ausencia de pagos", () => {
    leerCandidatos.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/No encontramos pagos compatibles/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("permite reintentar el error inicial y recupera candidatos sin registrar pagos", async () => {
    leerCandidatos.mockRejectedValueOnce(new Error("Lectura simulada fallida"));
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos consultar los pagos/);
    expect(screen.queryByText(/No encontramos pagos compatibles/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Crea el pago manualmente/)).not.toBeInTheDocument();
    let resolver = (_res: SugerenciasResultado) => {};
    leerCandidatos.mockReturnValueOnce(new Promise<SugerenciasResultado>((resolve) => { resolver = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar búsqueda/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true"));
    await act(async () => { resolver(resultado); });
    expect(await screen.findByText("Cliente de prueba")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(leerCandidatos).toHaveBeenCalledTimes(2);
    expect(leerCandidatos).toHaveBeenLastCalledWith(movimiento);
  });

  it("sólo un resultado vacío confirmado pide comprobar si el pago ya está registrado", async () => {
    leerCandidatos.mockResolvedValueOnce({ candidatos: [], truncado: false });
    montar();
    expect(await screen.findByText(/Revisa en Cobranza o Compras si el pago ya está registrado/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("conserva los candidatos anteriores al fallar una actualización y permite recuperarlos", async () => {
    leerCandidatos.mockResolvedValueOnce(resultado);
    montar();
    await screen.findByText("Cliente de prueba");
    leerCandidatos.mockRejectedValueOnce(new Error("Actualización simulada fallida"));
    await act(async () => { await client.refetchQueries(); });
    expect(await screen.findByRole("alert")).toHaveTextContent(/últimos datos cargados/);
    expect(screen.getByText("Cliente de prueba")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Conciliar$/ })).toBeEnabled();
    expect(screen.queryByText(/No encontramos pagos compatibles/)).not.toBeInTheDocument();
    let resolver = (_res: SugerenciasResultado) => {};
    leerCandidatos.mockReturnValueOnce(new Promise<SugerenciasResultado>((resolve) => { resolver = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar búsqueda/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Reintentar búsqueda/ })).toBeDisabled());
    expect(screen.getByText("Cliente de prueba")).toBeInTheDocument();
    await act(async () => { resolver(resultado); });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("Cliente de prueba")).toBeInTheDocument();
  });

  it("no presenta un vacío anterior como consulta actual confirmada si el refresco falla", async () => {
    leerCandidatos.mockResolvedValueOnce({ candidatos: [], truncado: false });
    montar();
    await screen.findByText(/No encontramos pagos compatibles/);
    leerCandidatos.mockRejectedValueOnce(new Error("Actualización simulada fallida"));
    await act(async () => { await client.refetchQueries(); });
    expect(await screen.findByRole("alert")).toHaveTextContent(/últimos datos cargados/);
    expect(screen.queryByText(/No encontramos pagos compatibles/)).not.toBeInTheDocument();
  });

  it("un movimiento diferente no hereda los candidatos anteriores al fallar su lectura", async () => {
    leerCandidatos.mockResolvedValueOnce(resultado);
    const vista = montar();
    await screen.findByText("Cliente de prueba");
    leerCandidatos.mockRejectedValueOnce(new Error("Lectura del segundo movimiento fallida"));
    vista.rerender(<QueryClientProvider client={client}>
      <PanelConciliacionMovimiento movimiento={{ ...movimiento, id: "otro-movimiento-ficticio" }} onClose={vi.fn()} />
    </QueryClientProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos consultar los pagos/);
    expect(screen.queryByText("Cliente de prueba")).not.toBeInTheDocument();
  });
});
