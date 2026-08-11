/**
 * Tests de `useAnticiposProveedor`: mapeo aplicado/disponible desde el
 * servicio real, estabilidad de la queryKey según filtros y estado de error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";

const fetchAnticiposProveedor = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(
  async () => [],
);
vi.mock("@/features/anticipos-proveedor/services/anticiposProveedorService", () => ({
  fetchAnticiposProveedor: (...a: unknown[]) => fetchAnticiposProveedor(...(a as [])),
}));

const { useAnticiposProveedor } = await import(
  "@/features/anticipos-proveedor/hooks/useAnticiposProveedor"
);

function anticipo(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    monto: 1000,
    saldo_disponible: 400,
    estado: "aplicado_parcial",
    proveedor_id: "p1",
    proveedor_nombre: "Proveedor Uno",
    embarque_expediente: null,
    fecha_anticipo: "2026-08-01",
    ...overrides,
  };
}

describe("useAnticiposProveedor", () => {
  beforeEach(() => {
    fetchAnticiposProveedor.mockClear();
  });

  it("mapea aplicado = monto - saldo_disponible y disponible = saldo_disponible", async () => {
    fetchAnticiposProveedor.mockResolvedValueOnce([anticipo()]);
    const { result } = renderHook(() => useAnticiposProveedor(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].aplicado).toBe(600);
    expect(result.current.data[0].disponible).toBe(400);
  });

  it("mapea cada fila de una lista con montos distintos", async () => {
    fetchAnticiposProveedor.mockResolvedValueOnce([
      anticipo({ id: "a1", monto: 1000, saldo_disponible: 1000 }), // disponible total
      anticipo({ id: "a2", monto: 500, saldo_disponible: 0 }), // aplicado total
    ]);
    const { result } = renderHook(() => useAnticiposProveedor(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data[0]).toMatchObject({ aplicado: 0, disponible: 1000 });
    expect(result.current.data[1]).toMatchObject({ aplicado: 500, disponible: 0 });
  });

  it("pasa los filtros recibidos al servicio", async () => {
    fetchAnticiposProveedor.mockResolvedValueOnce([]);
    renderHook(
      () => useAnticiposProveedor({ estado: "disponible", proveedorId: "p1" }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(fetchAnticiposProveedor).toHaveBeenCalled());
    expect(fetchAnticiposProveedor).toHaveBeenCalledWith({
      estado: "disponible",
      proveedorId: "p1",
    });
  });

  it("usa la misma queryKey (list) cuando los filtros son equivalentes", async () => {
    fetchAnticiposProveedor.mockResolvedValue([]);
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ estado }: { estado: string | null }) => useAnticiposProveedor({ estado }),
      { wrapper, initialProps: { estado: "disponible" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    fetchAnticiposProveedor.mockClear();

    // Nuevo objeto de filtros pero con el mismo valor de `estado`: no debe
    // disparar un refetch porque la queryKey normalizada es idéntica.
    rerender({ estado: "disponible" });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchAnticiposProveedor).not.toHaveBeenCalled();

    expect(anticiposProveedorKeys.list({ estado: "disponible", proveedorId: null })).toEqual(
      anticiposProveedorKeys.list({ estado: "disponible", proveedorId: null }),
    );
  });

  it("cambia la queryKey (y refetch) cuando cambia el filtro de estado", async () => {
    fetchAnticiposProveedor.mockResolvedValue([]);
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ estado }: { estado: string | null }) => useAnticiposProveedor({ estado }),
      { wrapper, initialProps: { estado: "disponible" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    fetchAnticiposProveedor.mockClear();

    rerender({ estado: "aplicado" });
    await waitFor(() =>
      expect(fetchAnticiposProveedor).toHaveBeenCalledWith({ estado: "aplicado" }),
    );
  });

  it("normaliza estado/proveedorId ausentes a null en la queryKey", () => {
    expect(anticiposProveedorKeys.list({ estado: null, proveedorId: null })).toEqual([
      "anticipos-proveedor",
      "list",
      { estado: null, proveedorId: null },
    ]);
  });

  it("expone isError y error cuando el servicio rechaza", async () => {
    const boom = new Error("no se pudo leer anticipos");
    fetchAnticiposProveedor.mockRejectedValueOnce(boom);
    const { result } = renderHook(() => useAnticiposProveedor(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toEqual([]);
  });
});
