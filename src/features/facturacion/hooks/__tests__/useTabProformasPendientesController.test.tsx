/**
 * Tests del controller `useTabProformasPendientesController`.
 * Verifica filtrado por search, selección, reglas puedeConsolidar/puedeAprobar
 * y los payloads enviados a aprobar/consolidar mutations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const aprobarMutate = vi.fn();
const consolidarMutate = vi.fn();
const useProformasPendientesMock = vi.fn();

vi.mock("@/features/embarques/hooks/useProformas", () => ({
  useProformasPendientes: () => useProformasPendientesMock(),
  useAprobarProformas: () => ({ mutate: aprobarMutate, isPending: false }),
  useConsolidarProformas: () => ({ mutate: consolidarMutate, isPending: false }),
}));
vi.mock("@/hooks/catalogos/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/lib/idempotency", () => ({
  useStableRequestId: () => ({ get: () => "req-xyz", reset: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { useTabProformasPendientesController } from "../useTabProformasPendientesController";

const p = (over: Record<string, unknown> = {}) => ({
  id: "p1", expediente: "EXP-001", cliente_id: "c1", cliente_nombre: "ACME",
  numero: "PRO-001", bl_master: "BL1", fecha_emision: "2026-01-01",
  operador: "Op", dias_credito: 30,
  subtotal_usd: 100, iva_usd: 16, total_usd: 116,
  subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0,
  embarque_id: "emb-1",
  embarques: { id: "emb-1", bl_master: "BL1" },
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe("useTabProformasPendientesController", () => {
  it("filtra por search sobre cliente_nombre", () => {
    useProformasPendientesMock.mockReturnValue({
      data: [p(), p({ id: "p2", cliente_nombre: "Beta Corp", numero: "PRO-002" })],
      isLoading: false,
    });
    const { result } = renderHook(() => useTabProformasPendientesController(), { wrapper: createWrapper() });
    act(() => result.current.setSearch("beta"));
    const ids = result.current.grupos.flatMap((g) => g.proformas.map((x) => x.id));
    expect(ids).toEqual(["p2"]);
  });

  it("puedeConsolidar=true sólo con ≥2 proformas del MISMO embarque", () => {
    useProformasPendientesMock.mockReturnValue({
      data: [p({ id: "p1", embarque_id: "e1" }), p({ id: "p2", embarque_id: "e1", numero: "PRO-2" })],
      isLoading: false,
    });
    const { result } = renderHook(() => useTabProformasPendientesController(), { wrapper: createWrapper() });
    act(() => { result.current.toggleSelect("p1"); result.current.toggleSelect("p2"); });
    expect(result.current.puedeConsolidar).toBe(true);
    expect(result.current.puedeAprobar).toBe(true);
    expect(result.current.embarquesEnSeleccion).toBe(1);
  });

  it("puedeConsolidar=false con proformas de embarques distintos", () => {
    useProformasPendientesMock.mockReturnValue({
      data: [
        p({ id: "p1", embarque_id: "e1", embarques: { id: "e1", bl_master: "BL1" } }),
        p({ id: "p2", embarque_id: "e2", numero: "PRO-2", expediente: "EXP-002", embarques: { id: "e2", bl_master: "BL2" } }),
      ],
      isLoading: false,
    });
    const { result } = renderHook(() => useTabProformasPendientesController(), { wrapper: createWrapper() });
    act(() => { result.current.toggleSelect("p1"); result.current.toggleSelect("p2"); });
    expect(result.current.embarquesEnSeleccion).toBe(2);
    expect(result.current.puedeConsolidar).toBe(false);
  });

  it("handleAprobar invoca mutate con los IDs seleccionados", () => {
    useProformasPendientesMock.mockReturnValue({ data: [p()], isLoading: false });
    const { result } = renderHook(() => useTabProformasPendientesController(), { wrapper: createWrapper() });
    act(() => result.current.toggleSelect("p1"));
    act(() => result.current.handleAprobar());
    expect(aprobarMutate).toHaveBeenCalledTimes(1);
    expect(aprobarMutate.mock.calls[0][0]).toEqual({ proformaIds: ["p1"] });
  });

  it("handleConsolidar envía payload completo con tasaIva y requestId", () => {
    useProformasPendientesMock.mockReturnValue({
      data: [p({ id: "p1", embarque_id: "e1" }), p({ id: "p2", embarque_id: "e1", numero: "PRO-2" })],
      isLoading: false,
    });
    const { result } = renderHook(() => useTabProformasPendientesController(), { wrapper: createWrapper() });
    act(() => { result.current.toggleSelect("p1"); result.current.toggleSelect("p2"); });
    act(() => result.current.handleConsolidar());
    expect(consolidarMutate).toHaveBeenCalledTimes(1);
    const payload = consolidarMutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      proformaIds: expect.arrayContaining(["p1", "p2"]),
      embarqueId: "e1", clienteId: "c1",
      tasaIva: 0.16, requestId: "req-xyz",
    });
  });
});
