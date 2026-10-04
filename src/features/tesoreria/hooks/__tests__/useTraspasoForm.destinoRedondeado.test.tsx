import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";

vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: () => ({ data: null }),
}));

import { useTraspasoForm } from "../useTraspasoForm";

const cuentas = [
  { id: "mxn", moneda: "MXN", activa: true },
  { id: "usd", moneda: "USD", activa: true },
] as unknown as Tables<"cuentas_bancarias">[];

function preparar(monto: number, origen = "mxn", destino = "usd") {
  const hook = renderHook(() => useTraspasoForm(true, cuentas));
  act(() => {
    hook.result.current.setField("origenId", origen);
    hook.result.current.setField("destinoId", destino);
    hook.result.current.setField("montoOrigen", monto);
  });
  act(() => hook.result.current.setField("tcQuote", 18.1903));
  return hook;
}

describe("59 · importe destino a centavos", () => {
  it("MXN0.01 a USD muestra cero y explica el redondeo antes del envío", () => {
    const { result } = preparar(0.01);
    expect(result.current.montoDestino).toBe(0);
    expect(result.current.error).toMatch(/destino.*0\.00.*redondeo/i);
  });

  it("al aumentar el importe permite el primer centavo destino y revalida al reducirlo", () => {
    const { result } = preparar(0.01);
    act(() => result.current.setField("montoOrigen", 0.10));
    expect(result.current.montoDestino).toBe(0.01);
    expect(result.current.error).toBeNull();
    act(() => result.current.setField("montoOrigen", 0.01));
    expect(result.current.error).toMatch(/destino.*0\.00.*redondeo/i);
  });

  it("revalida también al modificar el TC y conserva la captura", () => {
    const { result } = preparar(0.08);
    expect(result.current.montoDestino).toBe(0);
    act(() => result.current.setField("tcQuote", 15));
    expect(result.current.montoDestino).toBe(0.01);
    expect(result.current.error).toBeNull();
    act(() => result.current.setField("tcQuote", 20));
    expect(result.current.error).toMatch(/destino.*0\.00.*redondeo/i);
    expect(result.current.state.montoOrigen).toBe(0.08);
  });

  it("USD0.01 a MXN conserva el abono positivo calculado", () => {
    const { result } = preparar(0.01, "usd", "mxn");
    expect(result.current.montoDestino).toBe(0.18);
    expect(result.current.error).toBeNull();
  });
});
