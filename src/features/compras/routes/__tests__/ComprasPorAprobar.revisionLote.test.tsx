import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FacturaCxP } from "@/features/cxp/services";
import { useSeleccionEfectiva } from "../ComprasPorAprobar.seleccion";
import { useRevisionLote } from "../ComprasPorAprobar.useRevisionLote";

describe("confirmación de lote revisado", () => {
  it("preserva IDs, totales y versiones antes de un refetch", async () => {
    const aprobar = vi.fn().mockResolvedValue({ exitos: [], fallos: [] });
    const limpiar = vi.fn();
    const f = { id: "f1", updated_at: "v1", total: 100, moneda: "USD", embarque_id: "e1", estado_aprobacion: "pendiente" } as FacturaCxP;
    const { result, rerender } = renderHook(({ rows }) => {
      const seleccion = useSeleccionEfectiva(rows, new Set(["f1"]), new Set());
      return useRevisionLote(seleccion, aprobar, limpiar);
    }, { initialProps: { rows: [f] } });
    act(() => result.current.abrir());
    rerender({ rows: [{ ...f, updated_at: "v2", total: 200 }] });
    expect(result.current.confirmacion.totalUsd).toBe(100);
    await act(() => result.current.confirmar());
    expect(aprobar).toHaveBeenCalledWith(["f1"], expect.objectContaining({ versionesRevisadas: new Map([["f1", "v1"]]) }));
    expect(limpiar).toHaveBeenCalledOnce();
  });
});
