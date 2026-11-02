import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { confirmado } from "@/features/cobranza/services/__tests__/recordatorioFixtures";
import { createWrapper } from "@/test/utils/queryWrapper";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { AuthOperationChangedError } from "@/lib/auth/authOperationScope";

const notifyError = vi.fn();
const notifySuccess = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

const supabaseMock = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { useRecordatorioCobranza } from "@/features/cobranza/hooks/useRecordatorioCobranza";

beforeEach(() => {
  supabaseMock.functions.invoke.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
});

describe("useRecordatorioCobranza", () => {
  it.each(['mutate', 'mutateAsync'] as const)('%s captura la sesión antes de las microtareas de onMutate', async (method) => {
    setAuthSnapshot({ userId: 'user-a', email: null, organizationId: 'org-a', organizationName: null,
      role: 'contador', effectiveRole: 'contador' });
    const { result } = renderHook(() => useRecordatorioCobranza(), { wrapper: createWrapper() });
    await act(async () => {
      const pending = result.current[method]({ facturaId: 'fact-a', destinatarioConfirmado: confirmado() });
      setAuthSnapshot({ userId: 'user-b', email: null, organizationId: 'org-a', organizationName: null,
        role: 'contador', effectiveRole: 'contador' });
      if (pending) await expect(pending).rejects.toBeInstanceOf(AuthOperationChangedError);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AuthOperationChangedError);
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("camino feliz: notifica éxito, invalida queries de cobranza y llama onSuccess", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "cliente@correo.mx" },
      error: null,
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useRecordatorioCobranza({ onSuccess }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ facturaId: "fact-1", nota: "pagar pronto", destinatarioConfirmado: confirmado() });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Recordatorio enviado" }),
    );
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-confirmar",
      expect.objectContaining({
        body: expect.objectContaining({ factura_id: "fact-1", canal: "email" }),
      }),
    );
  });

  it("caso borde: envía sin nota y conserva la identidad de destinatario confirmada", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "otro@correo.mx" },
      error: null,
    });

    const { result } = renderHook(() => useRecordatorioCobranza(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ facturaId: "fact-2", destinatarioConfirmado: confirmado("otro@correo.mx") });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-confirmar",
      expect.objectContaining({
        body: expect.objectContaining({
          nota: undefined,
          confirmacion_version: 2, destinatario_confirmado: confirmado("otro@correo.mx"),
          canal: "email",
        }),
      }),
    );
  });

  it("maneja error de negocio (ok falso) notificando el error", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: false },
      error: null,
    });

    const { result } = renderHook(() => useRecordatorioCobranza(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ facturaId: "fact-3", destinatarioConfirmado: confirmado() });
      } catch {
        // esperado
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Error al enviar recordatorio" }),
    );
  });

  it("maneja error de transporte de supabase", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("timeout de red"),
    });

    const { result } = renderHook(() => useRecordatorioCobranza(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ facturaId: "fact-4", destinatarioConfirmado: confirmado() });
      } catch {
        // esperado
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("timeout de red");
  });
});
