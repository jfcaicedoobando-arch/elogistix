/**
 * Tests focalizados de `useTimbrarFacturaDialog` — hook que orquesta 3 mutaciones
 * (actualizar datos, timbrar, guardar defaults + enviar CFDI email).
 *
 * Cubre:
 *  - Resolución de defaults con precedencia factura > defaults > cliente > fallback.
 *  - `onConfirm` feliz: actualizarDatos → timbrar → guardarDefaults + enviarCfdi → onClose.
 *  - `onConfirm` cuando actualizarDatos falla: NO timbra, notifica error.
 *  - Setters expuestos actualizan el estado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/features/facturacion/services", () => ({
  actualizarDatosTimbradoFactura: vi.fn(),
  guardarDefaultsTimbradoCliente: vi.fn(),
}));
vi.mock("@/features/facturacion/services/enviarCfdiEmail", () => ({
  enviarCfdiFactura: vi.fn(),
}));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({
  useTimbrarFactura: vi.fn(),
}));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

import {
  actualizarDatosTimbradoFactura,
  guardarDefaultsTimbradoCliente,
} from "@/features/facturacion/services";
import { enviarCfdiFactura } from "@/features/facturacion/services/enviarCfdiEmail";
import { useTimbrarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { notifyError } from "@/lib/ui/appFeedback";
import { useTimbrarFacturaDialog } from "@/features/facturacion/hooks/useTimbrarFacturaDialog";

const mockActualizar = vi.mocked(actualizarDatosTimbradoFactura);
const mockGuardar = vi.mocked(guardarDefaultsTimbradoCliente);
const mockEnviar = vi.mocked(enviarCfdiFactura);
const mockTimbrar = vi.mocked(useTimbrarFactura);
const mockNotifyError = vi.mocked(notifyError);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function setupTimbrar(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean }> = {}) {
  const mutate = overrides.mutate ?? vi.fn((_id, opts?: { onSuccess?: (res: unknown) => void | Promise<void> }) => {
    void opts?.onSuccess?.({ uuid: "abc-123" });
  });
  mockTimbrar.mockReturnValue({ mutate, isPending: overrides.isPending ?? false } as never);
  return mutate;
}

const factura = {
  id: "f-1",
  cliente_id: "cli-1",
  uso_cfdi: "G01",
  forma_pago: "01",
  metodo_pago: "PUE",
};

describe("useTimbrarFacturaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActualizar.mockResolvedValue(undefined as never);
    mockGuardar.mockResolvedValue(undefined as never);
    mockEnviar.mockResolvedValue({ enviado_a: "a@b.com" } as never);
  });

  it("resuelve defaults con precedencia factura > defaults > cliente > fallback", () => {
    setupTimbrar();
    // Factura tiene uso_cfdi=G01 → gana sobre defaults/cliente.
    const { result } = renderHook(
      () => useTimbrarFacturaDialog(factura, { uso_cfdi_default: "G03" } as never, { uso_cfdi: "P01" } as never, vi.fn()),
      { wrapper: makeWrapper() },
    );
    expect(result.current.usoCfdi).toBe("G01");
    expect(result.current.formaPago).toBe("01");
    expect(result.current.metodoPago).toBe("PUE");
  });

  it("cae a fallback G03/99/PPD cuando no hay factura/defaults/cliente", () => {
    setupTimbrar();
    const { result } = renderHook(
      () => useTimbrarFacturaDialog({ ...factura, uso_cfdi: null, forma_pago: null, metodo_pago: null }, null, null, vi.fn()),
      { wrapper: makeWrapper() },
    );
    expect(result.current.usoCfdi).toBe("G03");
    expect(result.current.formaPago).toBe("99");
    expect(result.current.metodoPago).toBe("PPD");
  });

  it("onConfirm feliz: actualiza datos, timbra, guarda defaults y envía CFDI, luego cierra", async () => {
    const onClose = vi.fn();
    const mutate = setupTimbrar();
    const { result } = renderHook(
      () => useTimbrarFacturaDialog(factura, null, null, onClose, { emailDestino: "fiscal@example.invalid" }),
      { wrapper: makeWrapper() },
    );

    expect(result.current.enviarEmail).toBe(false);
    act(() => result.current.setEnviarEmail(true));
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(mockActualizar).toHaveBeenCalledWith("f-1", {
      uso_cfdi: "G01",
      forma_pago: "01",
      metodo_pago: "PUE",
    });
    expect(mutate).toHaveBeenCalledWith("f-1", expect.objectContaining({ onSuccess: expect.any(Function) }));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockGuardar).toHaveBeenCalledWith("cli-1", {
      uso_cfdi_default: "G01",
      forma_pago_default: "01",
      metodo_pago_default: "PUE",
    });
    expect(mockEnviar).toHaveBeenCalledWith("f-1", "fiscal@example.invalid");
    expect(onClose).toHaveBeenCalled();
  });

  it("no envía CFDI cuando enviarEmail=false", async () => {
    const mutate = setupTimbrar();
    const { result } = renderHook(
      () => useTimbrarFacturaDialog(factura, null, null, vi.fn()),
      { wrapper: makeWrapper() },
    );
    act(() => result.current.setEnviarEmail(false));
    await act(async () => {
      await result.current.onConfirm();
    });
    expect(mutate).toHaveBeenCalled();
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it("si actualizarDatos falla, NO timbra y notifica error", async () => {
    const mutate = setupTimbrar();
    mockActualizar.mockRejectedValueOnce(new Error("400 datos inválidos"));
    const { result } = renderHook(
      () => useTimbrarFacturaDialog(factura, null, null, vi.fn()),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      await expect(result.current.onConfirm()).rejects.toThrow(/400 datos inválidos/);
    });

    expect(mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalled());
  });

  it("onConfirm no hace nada si no hay factura", async () => {
    const mutate = setupTimbrar();
    const { result } = renderHook(
      () => useTimbrarFacturaDialog(null, null, null, vi.fn()),
      { wrapper: makeWrapper() },
    );
    await act(async () => {
      await result.current.onConfirm();
    });
    expect(mockActualizar).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("no envía sin destinatario explícito aunque se marque la opción", async () => {
    setupTimbrar();
    const { result } = renderHook(() => useTimbrarFacturaDialog(factura, null, null, vi.fn()), { wrapper: makeWrapper() });
    act(() => result.current.setEnviarEmail(true));
    await act(async () => { await result.current.onConfirm(); });
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it("202 pendiente no envía correo ni guarda preferencias aunque exista consentimiento", async () => {
    setupTimbrar({ mutate: vi.fn((_id, opts?: { onSuccess?: (res: unknown) => void | Promise<void> }) => {
      void opts?.onSuccess?.({ pendiente: true, message: "Timbrado en proceso" });
    }) });
    const onClose = vi.fn();
    const { result } = renderHook(() => useTimbrarFacturaDialog(factura, null, null, onClose, { emailDestino: "fiscal@example.invalid" }), { wrapper: makeWrapper() });
    act(() => result.current.setEnviarEmail(true));
    await act(async () => { await result.current.onConfirm(); });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockEnviar).not.toHaveBeenCalled();
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it("reinicia el consentimiento al reabrir o cambiar factura/destinatario", () => {
    setupTimbrar();
    const { result, rerender } = renderHook(
      ({ id, email, open }) => useTimbrarFacturaDialog({ ...factura, id }, null, null, vi.fn(), { emailDestino: email, open }),
      { initialProps: { id: "f-1", email: "uno@example.invalid", open: true }, wrapper: makeWrapper() },
    );
    act(() => result.current.setEnviarEmail(true));
    rerender({ id: "f-1", email: "uno@example.invalid", open: false });
    expect(result.current.enviarEmail).toBe(false);
    act(() => result.current.setEnviarEmail(true));
    rerender({ id: "f-2", email: "dos@example.invalid", open: true });
    expect(result.current.enviarEmail).toBe(false);
  });
});
