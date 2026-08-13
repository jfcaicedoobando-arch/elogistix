import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const svc = vi.hoisted(() => ({
  fetchProveedorDocumentos: vi.fn(async () => []),
  subirDocumentoProveedor: vi.fn(async () => ({ id: "d1" })),
  eliminarDocumentoProveedor: vi.fn(async () => undefined),
}));
vi.mock("@/features/proveedor/services/proveedorDocumentos", () => svc);

const feedback = vi.hoisted(() => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => feedback);

import {
  useProveedorDocumentos,
  useSubirDocumentoProveedor,
  useEliminarDocumentoProveedor,
} from "@/features/proveedor/hooks/useProveedorDocumentos";
import { proveedores } from "@/features/proveedor/queryKeys";

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  svc.fetchProveedorDocumentos.mockClear();
  svc.eliminarDocumentoProveedor.mockClear();
  feedback.notifySuccess.mockClear();
  feedback.notifyError.mockClear();
});

describe("useProveedorDocumentos", () => {
  it("no consulta sin proveedor", () => {
    const { wrapper } = setup();
    renderHook(() => useProveedorDocumentos(undefined), { wrapper });
    expect(svc.fetchProveedorDocumentos).not.toHaveBeenCalled();
  });

  it("usa la clave del catálogo central", async () => {
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useProveedorDocumentos("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(proveedores.documentos("p1"))).toEqual([]);
  });
});

describe("mutaciones del expediente", () => {
  it("invalida la caché del proveedor tras subir", async () => {
    const { qc, wrapper } = setup();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSubirDocumentoProveedor("p1"), { wrapper });
    await result.current.mutateAsync({
      proveedorId: "p1",
      organizationId: "o1",
      tipo: "Contrato",
      archivo: new File(["x"], "c.pdf", { type: "application/pdf" }),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: proveedores.documentos("p1") });
    expect(feedback.notifySuccess).toHaveBeenCalled();
  });

  it("invalida la caché tras eliminar", async () => {
    const { qc, wrapper } = setup();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useEliminarDocumentoProveedor("p1"), { wrapper });
    await result.current.mutateAsync({ id: "d1", archivo: "proveedores/p1/c.pdf" });
    expect(svc.eliminarDocumentoProveedor).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: proveedores.documentos("p1") });
  });

  it("avisa con el mensaje del servidor cuando falla", async () => {
    svc.eliminarDocumentoProveedor.mockRejectedValueOnce(new Error("RLS bloqueó"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useEliminarDocumentoProveedor("p1"), { wrapper });
    await expect(
      result.current.mutateAsync({ id: "d1", archivo: "a" }),
    ).rejects.toBeTruthy();
    expect(feedback.notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ description: "RLS bloqueó" }),
    );
  });
});
