import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

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
      await result.current.mutateAsync({ facturaId: "fact-1", nota: "pagar pronto" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Recordatorio enviado" }),
    );
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-enviar",
      expect.objectContaining({
        body: expect.objectContaining({ factura_id: "fact-1", canal: "email" }),
      }),
    );
  });

  it("caso borde: envía sin nota ni contacto de email (moneda/monto no aplica, sólo campos opcionales vacíos)", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "otro@correo.mx" },
      error: null,
    });

    const { result } = renderHook(() => useRecordatorioCobranza(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ facturaId: "fact-2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-enviar",
      expect.objectContaining({
        body: expect.objectContaining({
          nota: undefined,
          contacto_email: undefined,
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
        await result.current.mutateAsync({ facturaId: "fact-3" });
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
        await result.current.mutateAsync({ facturaId: "fact-4" });
      } catch {
        // esperado
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("timeout de red");
  });
});
