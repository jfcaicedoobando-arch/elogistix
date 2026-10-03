import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { facturas } from "../../queryKeys";

const notas = [
  { id: "borrador", estado: "Borrador", deleted_at: null, monto: 58 },
  { id: "aplicada", estado: "Aplicada", deleted_at: null, monto: 10 },
  { id: "cancelada", estado: "Cancelada", deleted_at: null, monto: 20 },
  { id: "eliminada", estado: "Aplicada", deleted_at: "2026-10-01", monto: 30 },
];
vi.mock("@/features/facturacion/services/notasCredito", () => ({
  listarNotasCreditoPorFactura: vi.fn(async () => notas),
}));
vi.mock("@/features/facturacion/services/saldoFacturaServidor", () => ({ fetchSaldoFacturaServidor: vi.fn() }));
import { useNotasCreditoAplicadas } from "../useSaldoFactura";
import { useNotasCreditoDeFactura } from "../useNotasCreditoDeFactura";

describe("NC: caché completa con selección por observador", () => {
  for (const aplicadasPrimero of [true, false]) {
    it(`preserva borradores al montar ${aplicadasPrimero ? "saldo" : "lista"} primero y después de refetch`, async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
      const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
      const usePrimero = aplicadasPrimero ? useNotasCreditoAplicadas : useNotasCreditoDeFactura;
      const primero = renderHook(() => usePrimero("f1"), { wrapper });
      await waitFor(() => expect(primero.result.current.isSuccess).toBe(true));
      const ambos = renderHook(() => ({ lista: useNotasCreditoDeFactura("f1"), saldo: useNotasCreditoAplicadas("f1") }), { wrapper });
      await waitFor(() => expect(ambos.result.current.lista.data).toHaveLength(4));
      expect(ambos.result.current.saldo.data?.map((n) => n.id)).toEqual(["aplicada"]);
      expect(qc.getQueryData(facturas.notasCredito("f1"))).toEqual(notas);
      await act(async () => { await qc.invalidateQueries({ queryKey: facturas.notasCredito("f1") }); });
      expect(ambos.result.current.lista.data?.map((n) => n.id)).toContain("borrador");
      expect(ambos.result.current.saldo.data?.map((n) => n.id)).toEqual(["aplicada"]);
      primero.unmount(); ambos.unmount(); qc.clear();
    });
  }
});
