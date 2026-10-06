import type { PropsWithChildren } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEstadoCuenta } from "../useEstadoCuenta";
import { mapFacturaEstadoCuenta, type KpisEstadoCuentaRemotos } from "../../services/estadoCuentaTypes";

const h = vi.hoisted(() => ({ rows: vi.fn(), kpis: vi.fn() }));
vi.mock("../../services/estadoCuenta", () => ({ fetchEstadoCuenta: h.rows, fetchEstadoCuentaKpis: h.kpis }));

const remoto: KpisEstadoCuentaRemotos = {
  adeudado_mxn: 10, adeudado_usd: 2, adeudado_eur: 3,
  vencido_mxn: 0, vencido_usd: 0, vencido_eur: 2,
  a_favor_mxn: 0, a_favor_usd: 0, a_favor_eur: 1, facturas_vencidas: 1, facturas_adeudadas: 3,
};
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    {children}
  </QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rows.mockResolvedValue([]);
  h.kpis.mockResolvedValue(remoto);
});

describe("AUD111: KPIs remotos y filtro EUR", () => {
  it("transporta las tres magnitudes EUR de la RPC sin descartarlas", async () => {
    const { result } = renderHook(() => useEstadoCuenta({ clienteIds: ["c1"], moneda: "todas" }), { wrapper });
    await waitFor(() => expect(result.current.kpis.adeudado.eur).toBe(3));
    expect(result.current.kpis.vencido.eur).toBe(2);
    expect(result.current.kpis.aFavor.eur).toBe(1);
    expect(h.kpis).toHaveBeenCalled();
  });

  it("el filtro EUR usa filas EUR y conserva el KPI local", async () => {
    h.rows.mockResolvedValue([mapFacturaEstadoCuenta({ id: "eur1", numero: "EUR1", cliente_id: "c1",
      cliente_nombre: "Cliente", expediente: "", moneda: "EUR", tipo_cambio: 20, total: 1,
      fecha_emision: "2026-10-05", fecha_vencimiento: "2099-01-01", estado: "Emitida",
      pagos_factura: [], factura_notas_credito: [],
    })]);
    const filters = { clienteIds: ["c1"], moneda: "EUR" as const };
    const { result } = renderHook(() => useEstadoCuenta(filters), { wrapper });
    await waitFor(() => expect(result.current.kpis.adeudado.eur).toBe(1));
    expect(h.rows).toHaveBeenCalledWith(filters);
    expect(h.kpis).not.toHaveBeenCalled();
    expect(result.current.kpis.adeudado).toEqual({ mxn: 0, usd: 0, eur: 1 });
  });
});
