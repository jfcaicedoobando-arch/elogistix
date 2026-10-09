/**
 * @vitest-environment jsdom
 *
 * Ola v16 (3): un refetch de la lista de facturas (nuevo arreglo con los mismos
 * datos) NO debe reiniciar la captura del usuario ni regenerar el `request_id`
 * de idempotencia mientras el diálogo sigue abierto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

const mutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [] }),
}));
vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: () => ({ data: null }),
}));
vi.mock("@/features/facturacion/hooks/usePagoClienteLote", () => ({
  usePagoClienteLote: () => ({ mutateAsync, isPending: false }),
}));

import { usePagoClienteLoteState } from "../usePagoClienteLoteState";
import * as svc from "@/features/facturacion/services/pagoClienteLote";

const facturas = (): FacturaCobroCandidata[] => [
  { factura_id: "f1", numero: "F-1", fecha_vencimiento: "2026-08-10", saldo: 1000 },
  { factura_id: "f2", numero: "F-2", fecha_vencimiento: "2026-08-20", saldo: 500 },
];

beforeEach(() => {
  mutateAsync.mockClear();
  vi.spyOn(svc, "obtenerFacturasConRep").mockResolvedValue([]);
});

function args(lista: FacturaCobroCandidata[]) {
  return {
    open: true,
    clienteId: "cli-1",
    moneda: "MXN",
    facturas: lista,
    onOpenChange: vi.fn(),
    onDone: vi.fn(),
  };
}

async function requestIdDe(submit: () => Promise<void>): Promise<string> {
  await act(async () => {
    await submit();
  });
  const call = mutateAsync.mock.calls.at(-1)?.[0] as { request_id: string };
  return call.request_id;
}

describe("usePagoClienteLoteState · refetch no reinicia la captura", () => {
  it("conserva importe capturado y request_id tras un refetch de facturas", async () => {
    const { result, rerender } = renderHook((p: ReturnType<typeof args>) => usePagoClienteLoteState(p), {
      initialProps: args(facturas()),
    });

    // El usuario captura un cobro parcial.
    act(() => result.current.recalcular(1200));
    expect(result.current.total).toBe("1200");

    const id1 = await requestIdDe(result.current.submit);

    // Refetch: arreglo nuevo con los mismos datos (react-query invalidando).
    rerender(args(facturas()));

    expect(result.current.total).toBe("1200");
    const id2 = await requestIdDe(result.current.submit);
    expect(id2).toBe(id1);
  });

  it("genera un request_id nuevo al cerrar y reabrir el diálogo", async () => {
    const { result, rerender } = renderHook((p: ReturnType<typeof args>) => usePagoClienteLoteState(p), {
      initialProps: args(facturas()),
    });
    const id1 = await requestIdDe(result.current.submit);

    rerender({ ...args(facturas()), open: false });
    rerender(args(facturas()));

    const id2 = await requestIdDe(result.current.submit);
    expect(id2).not.toBe(id1);
  });
  it("AUD54: refetch con PUE ya cobrado bloquea el submit conservando la captura", async () => {
    const inicial = [{ ...facturas()[0], metodo_pago: "PUE", pagado: 0 }, facturas()[1]];
    const { result, rerender } = renderHook((p: ReturnType<typeof args>) => usePagoClienteLoteState(p), {
      initialProps: args(inicial),
    });
    const captura = result.current.total;
    rerender(args([{ ...inicial[0], pagado: 999.99, saldo: .01 }, inicial[1]]));
    expect(result.current.total).toBe(captura);
    expect(result.current.erroresRenglon.f1).toBeTruthy();
    await act(async () => { await result.current.submit(); });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("AUD54: dato nuevo durante la espera de REP se revalida antes de mutate", async () => {
    const inicial = [{ ...facturas()[0], metodo_pago: "PUE", pagado: 0 }, facturas()[1]];
    const { result, rerender } = renderHook((p: ReturnType<typeof args>) => usePagoClienteLoteState(p), {
      initialProps: args(inicial),
    });
    await act(async () => {});
    let resolver!: (ids: string[]) => void;
    vi.mocked(svc.obtenerFacturasConRep).mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    let envio!: Promise<void>;
    act(() => { envio = result.current.submit(); });
    rerender(args([{ ...inicial[0], pagado: 999.99, saldo: .01 }, inicial[1]]));
    await act(async () => { resolver([]); await envio; });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("AUD54: cerrar el diálogo durante la espera de REP no inicia un cobro", async () => {
    const { result, unmount } = renderHook(() => usePagoClienteLoteState(args(facturas())));
    await act(async () => {});
    let resolver!: (ids: string[]) => void;
    vi.mocked(svc.obtenerFacturasConRep).mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    let envio!: Promise<void>;
    act(() => { envio = result.current.submit(); });
    unmount();
    await act(async () => { resolver([]); await envio; });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

});
