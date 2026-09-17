/**
 * MNY (item 2): al cambiar la fecha del traspaso la sugerencia de tipo de
 * cambio debe actualizarse; si el usuario lo escribió a mano, se conserva.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Tables } from "@/integrations/supabase/types";

const tasas: Record<string, { fecha: string; usdMxn: number; eurMxn: number | null }> = {
  "2026-06-10": { fecha: "2026-06-10", usdMxn: 18, eurMxn: 20 },
  "2026-06-11": { fecha: "2026-06-11", usdMxn: 19, eurMxn: 21 },
};

vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: (fecha: string, enabled: boolean) => ({
    data: enabled ? tasas[fecha] ?? null : null,
  }),
}));

import { useTraspasoForm } from "../useTraspasoForm";

const cuentas = [
  { id: "mxn", moneda: "MXN", activa: true },
  { id: "usd", moneda: "USD", activa: true },
] as unknown as Tables<"cuentas_bancarias">[];

function montar() {
  const hook = renderHook(() => useTraspasoForm(true, cuentas));
  act(() => {
    hook.result.current.setField("origenId", "mxn");
    hook.result.current.setField("destinoId", "usd");
    hook.result.current.setField("fecha", "2026-06-10");
  });
  return hook;
}

describe("useTraspasoForm · tipo de cambio vs fecha", () => {
  it("actualiza la sugerencia al cambiar la fecha", async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(18, 4));

    act(() => result.current.setField("fecha", "2026-06-11"));
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(19, 4));
    expect(result.current.fechaTcDof).toBe("2026-06-11");
    expect(result.current.tcEsManual).toBe(false);
  });

  it("conserva el tipo de cambio capturado a mano al mover la fecha", async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(18, 4));

    act(() => result.current.setField("tcQuote", 17.5));
    expect(result.current.tcEsManual).toBe(true);

    act(() => result.current.setField("fecha", "2026-06-11"));
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(17.5, 4));
  });
});
