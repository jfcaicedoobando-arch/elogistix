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

  it("conserva justificación y revisión de las fallidas, y no vuelve a enviar las aprobadas", async () => {
    const revisada = "2026-10-05T00:01:02.123456+00:00";
    const aprobar = vi.fn()
      .mockResolvedValueOnce({ exitos: ["f1"], fallos: [{ id: "f2", error: "LC_CONFLICTO_CONCURRENCIA" }] })
      .mockResolvedValueOnce({ exitos: [], fallos: [{ id: "f2", error: "LC_CONFLICTO_CONCURRENCIA" }] });
    const limpiar = vi.fn();
    const rows = [
      { id: "f1", updated_at: revisada, total: 100, moneda: "USD", embarque_id: "e1", estado_aprobacion: "pendiente" },
      { id: "f2", updated_at: revisada, total: 200, moneda: "MXN", embarque_id: null, estado_aprobacion: "pendiente" },
    ] as FacturaCxP[];
    const { result, rerender } = renderHook(({ actuales }) => {
      const seleccion = useSeleccionEfectiva(actuales, new Set(["f1", "f2"]), new Set());
      return useRevisionLote(seleccion, aprobar, limpiar);
    }, { initialProps: { actuales: rows } });
    act(() => {
      result.current.abrir();
      result.current.setJustificacionLote("Gasto administrativo revisado");
    });
    await act(() => result.current.confirmar());
    rerender({ actuales: [{ ...rows[1], total: 300, updated_at: "2026-10-05T00:01:02.123457+00:00" }] });

    expect(result.current.confirmOpen).toBe(true);
    expect(result.current.justificacionLote).toBe("Gasto administrativo revisado");
    expect(result.current.confirmacion.ids).toEqual(["f2"]);
    expect(result.current.confirmacion.totalMxn).toBe(200);
    expect(result.current.confirmacion.totalUsd).toBe(0);
    expect(limpiar).not.toHaveBeenCalled();

    await act(() => result.current.confirmar());
    expect(aprobar).toHaveBeenLastCalledWith(["f2"], {
      justificacion: "Gasto administrativo revisado",
      requierenJustificacion: new Set(["f2"]),
      versionesRevisadas: new Map([["f2", revisada]]),
    });
  });
});
