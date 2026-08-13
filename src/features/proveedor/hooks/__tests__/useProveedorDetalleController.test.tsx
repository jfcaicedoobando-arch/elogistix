import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useProveedorDetalleController } from "../useProveedorDetalleController";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(() => ({ id: "prov-1" })),
}));

vi.mock("@/features/proveedor/hooks/useProveedores", () => ({
  useProveedor: vi.fn(() => ({ data: { id: "prov-1", nombre: "Prov One" }, isLoading: false })),
  useProveedorMutations: vi.fn(() => ({
    updateProveedor: vi.fn(),
    deleteProveedor: vi.fn(),
    isDeleting: false,
  })),
}));

vi.mock("@/features/proveedor/hooks/useProveedorEstadoCuenta", () => ({
  useProveedorEstadoCuenta: vi.fn(() => ({
    isLoading: false,
    data: {
      partidas: [
        {
          concepto_costo_id: "op1", comprometido: 1000, moneda: "MXN",
          estado_liquidacion: "Pagado", facturado: 1000, pagado: 1000,
          por_facturar: 0, facturas: [], estado_conciliacion: "Pagado",
        },
        {
          concepto_costo_id: "op2", comprometido: 500, moneda: "MXN",
          estado_liquidacion: "Pendiente", facturado: 0, pagado: 0,
          por_facturar: 500, facturas: [], estado_conciliacion: "Por facturar",
        },
      ],
      facturas_huerfanas: [],
    },
  })),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
  usePermissions: vi.fn(() => ({ canEdit: true, isAdmin: true })),
  useRegistrarActividad: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

describe("useProveedorDetalleController", () => {
  it("calculates totals correctly from operations", () => {
    const { result } = renderHook(() => useProveedorDetalleController(), { wrapper: createWrapper() });
    
    expect(result.current.totalFacturado).toBe(1500);
    expect(result.current.totalPagado).toBe(1000);
    expect(result.current.totalPendiente).toBe(500);
  });

  it("handles deletion", async () => {
    const { result } = renderHook(() => useProveedorDetalleController(), { wrapper: createWrapper() });
    
    await act(async () => {
      await result.current.handleDelete();
    });
    
    expect(result.current.deleteOpen).toBe(false);
  });

  // Regresión v13.320.63 — el toast lo emite `useProveedorMutations`.
  // Si el controller vuelve a notificar, el usuario ve doble aviso.
  it("no emite toasts propios: la notificación vive en la mutación", async () => {
    const { notifySuccess, notifyError } = await import("@/lib/ui/appFeedback");
    vi.mocked(notifySuccess).mockClear();
    vi.mocked(notifyError).mockClear();

    const { result } = renderHook(() => useProveedorDetalleController(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.handleUpdate("prov-1", { nombre: "Prov Editado" });
      await result.current.handleDelete();
    });

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });
});

