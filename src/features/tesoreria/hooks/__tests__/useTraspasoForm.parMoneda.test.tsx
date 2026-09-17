/**
 * MNY P1.1: al cambiar una cuenta cambia el par de monedas, así que la tasa
 * escrita a mano para el par anterior no puede reciclarse.
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
import { traspasoSucio } from "@/features/tesoreria/domain/traspasoForm";

const cuentas = [
  { id: "mxn", moneda: "MXN", activa: true },
  { id: "usd", moneda: "USD", activa: true },
  { id: "eur", moneda: "EUR", activa: true },
] as unknown as Tables<"cuentas_bancarias">[];

describe("useTraspasoForm · cambio de par de monedas", () => {
  it("invalida la tasa manual del par anterior y sugiere la del nuevo", async () => {
    const { result } = renderHook(() => useTraspasoForm(true, cuentas));
    act(() => {
      result.current.setField("origenId", "usd");
      result.current.setField("destinoId", "mxn");
      result.current.setField("fecha", "2026-06-10");
    });
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(18, 4));

    act(() => result.current.setField("tcQuote", 18.5));
    expect(result.current.tcEsManual).toBe(true);

    // USD→MXN pasa a EUR→MXN: la tasa capturada ya no aplica.
    act(() => result.current.setField("origenId", "eur"));
    expect(result.current.tcEsManual).toBe(false);
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(20, 4));
  });

  it("conserva la tasa manual si sólo cambia la fecha", async () => {
    const { result } = renderHook(() => useTraspasoForm(true, cuentas));
    act(() => {
      result.current.setField("origenId", "usd");
      result.current.setField("destinoId", "mxn");
      result.current.setField("fecha", "2026-06-10");
    });
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(18, 4));

    act(() => result.current.setField("tcQuote", 17.25));
    act(() => result.current.setField("fecha", "2026-06-11"));
    await waitFor(() => expect(result.current.state.tcQuote).toBeCloseTo(17.25, 4));
  });
});

describe("traspasoSucio · fecha", () => {
  it("no marca sucio el default de apertura y sí un cambio de fecha", () => {
    const base = {
      origenId: "", destinoId: "", fecha: "2026-06-10", montoOrigen: 0,
      tcQuote: 0, comision: 0, concepto: "", referencia: "",
    };
    expect(traspasoSucio(base, "2026-06-10")).toBe(false);
    expect(traspasoSucio({ ...base, fecha: "2026-06-09" }, "2026-06-10")).toBe(true);
  });
});
