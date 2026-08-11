/**
 * Tests de `cxcAging`: mapeo de la RPC, buckets de antigüedad, saldos por
 * moneda (sin mezclar) y propagación del error de Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>(
  async () => ({ data: [], error: null }),
);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...(args as [])) },
}));

const {
  fetchCxcAging,
  calcularTotalesAging,
  calcularTotalesPorMoneda,
} = await import("@/features/cxc/services/cxcAging");

describe("fetchCxcAging", () => {
  beforeEach(() => rpc.mockClear());

  it("mapea filas de la RPC, normaliza moneda y castea a número", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          cliente_id: "c1",
          cliente_nombre: "Cliente Uno",
          moneda: "mxn",
          saldo_total: "1500.5",
          vigente: "500",
          d_1_30: "300",
          d_31_60: "200",
          d_61_90: "100",
          mas_90: "400.5",
          num_facturas: "3",
        },
      ],
      error: null,
    });

    const rows = await fetchCxcAging("2026-08-09", "org-a");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      cliente_id: "c1",
      cliente_nombre: "Cliente Uno",
      moneda: "MXN",
      saldo_total: 1500.5,
      vigente: 500,
      d_1_30: 300,
      d_31_60: 200,
      d_61_90: 100,
      mas_90: 400.5,
      num_facturas: 3,
    });
  });

  it("usa 'MXN' por defecto cuando la moneda viene vacía", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          cliente_id: "c1",
          cliente_nombre: "Cliente Sin Moneda",
          moneda: null,
          saldo_total: 0,
          vigente: 0,
          d_1_30: 0,
          d_31_60: 0,
          d_61_90: 0,
          mas_90: 0,
          num_facturas: 0,
        },
      ],
      error: null,
    });
    const rows = await fetchCxcAging();
    expect(rows[0].moneda).toBe("MXN");
  });

  it("devuelve [] si data es null", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchCxcAging()).toEqual([]);
  });

  it("propaga el error de Supabase (throw)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("rpc caída") });
    await expect(fetchCxcAging("2026-08-09", "org-a")).rejects.toThrow("rpc caída");
  });
});

function fila(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    cliente_id: "c1",
    cliente_nombre: "Cliente",
    moneda: "MXN",
    saldo_total: 0,
    vigente: 0,
    d_1_30: 0,
    d_31_60: 0,
    d_61_90: 0,
    mas_90: 0,
    num_facturas: 0,
    ...overrides,
  };
}

describe("calcularTotalesAging", () => {
  it("suma cada cubeta de antigüedad y el total general", () => {
    const rows = [
      fila({ vigente: 100, d_1_30: 50, d_31_60: 20, d_61_90: 10, mas_90: 5, saldo_total: 185 }),
      fila({ vigente: 10, d_1_30: 5, d_31_60: 2, d_61_90: 1, mas_90: 1, saldo_total: 19 }),
    ];
    expect(calcularTotalesAging(rows)).toEqual({
      vigente: 110,
      d_1_30: 55,
      d_31_60: 22,
      d_61_90: 11,
      mas_90: 6,
      total: 204,
    });
  });

  it("devuelve todo en cero con lista vacía o nula", () => {
    const cero = { vigente: 0, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 0, total: 0 };
    expect(calcularTotalesAging([])).toEqual(cero);
    // SAFE-CAST: ejercita el guard `rows ?? []` con un valor nulo real.
    expect(calcularTotalesAging(null as unknown as [])).toEqual(cero);
  });

  it("considera saldos a favor (notas de crédito) como negativos en el saldo total", () => {
    // Una NC aplicada reduce el saldo vigente del cliente; puede llevarlo a negativo.
    const rows = [fila({ vigente: -200, saldo_total: -200 })];
    expect(calcularTotalesAging(rows).vigente).toBe(-200);
    expect(calcularTotalesAging(rows).total).toBe(-200);
  });
});

describe("calcularTotalesPorMoneda", () => {
  it("agrupa totales por moneda sin mezclarlos", () => {
    const rows = [
      fila({ moneda: "MXN", saldo_total: 100, vigente: 100 }),
      fila({ moneda: "USD", saldo_total: 50, vigente: 50 }),
      fila({ moneda: "MXN", saldo_total: 20, d_1_30: 20 }),
    ];
    const totales = calcularTotalesPorMoneda(rows);
    expect(Object.keys(totales).sort()).toEqual(["MXN", "USD"]);
    expect(totales.MXN.total).toBe(120);
    expect(totales.MXN.vigente).toBe(100);
    expect(totales.MXN.d_1_30).toBe(20);
    expect(totales.USD.total).toBe(50);
  });

  it("devuelve objeto vacío con lista vacía", () => {
    expect(calcularTotalesPorMoneda([])).toEqual({});
  });
});
