/**
 * v13.312.20 — Ola 1 · item 3: tests conductuales para la migración a
 * `useMutationWithFeedback` en el trío portal / notificaciones internas /
 * snooze de auditoría. Valida: invalidate + toast success al resolver, y
 * `notifyError` con título/método correctos al fallar.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock feedback helpers (única fuente de toasts en el wrapper).
const notifyError = vi.fn();
const notifySuccess = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

// ---- Portal notificaciones ----
const marcarNotificacionLeida = vi.fn();
const marcarTodasNotificacionesLeidas = vi.fn();
vi.mock("@/features/portal/services", () => ({
  fetchNotificacionesCliente: vi.fn(),
  marcarNotificacionLeida: (...a: unknown[]) => marcarNotificacionLeida(...a),
  marcarTodasNotificacionesLeidas: (...a: unknown[]) => marcarTodasNotificacionesLeidas(...a),
}));

// ---- Notificaciones internas ----
const svcMarcarLeida = vi.fn();
const svcMarcarTodas = vi.fn();
vi.mock("@/features/notificaciones/services", () => ({
  fetchNotificaciones: vi.fn(async () => []),
  marcarLeida: (...a: unknown[]) => svcMarcarLeida(...a),
  marcarTodasLeidas: (...a: unknown[]) => svcMarcarTodas(...a),
  subscribeNotificaciones: () => () => {},
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "u@x.mx" }, organizationId: "org1" }),
}));

// ---- Snooze hallazgo ----
const snoozeRevision = vi.fn();
const clearSnoozeRevision = vi.fn();
vi.mock("@/features/auditoria/services", () => ({
  snoozeRevision: (...a: unknown[]) => snoozeRevision(...a),
  clearSnoozeRevision: (...a: unknown[]) => clearSnoozeRevision(...a),
}));
vi.mock("@/features/auditoria/services/bitacora", () => ({
  insertBitacora: vi.fn(async () => ({})),
}));
vi.mock("@/features/auditoria/hooks/useAuditoriaRevisiones", () => ({
  hallazgoHash: () => "hash",
}));

import { useMarcarNotificacionLeida, useMarcarTodasLeidas } from "@/features/portal/hooks/useNotificacionesCliente";
import { useNotificacionesInternas } from "@/features/notificaciones/hooks/useNotificacionesInternas";
import { useSnoozeHallazgo, useQuitarSnooze } from "@/features/auditoria/hooks/useSnoozeHallazgo";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidateSpy };
}

beforeEach(() => {
  notifyError.mockReset();
  notifySuccess.mockReset();
  marcarNotificacionLeida.mockReset();
  marcarTodasNotificacionesLeidas.mockReset();
  svcMarcarLeida.mockReset();
  svcMarcarTodas.mockReset();
  snoozeRevision.mockReset();
  clearSnoozeRevision.mockReset();
});

describe("Ola 1 · item 3 — mutaciones migradas a useMutationWithFeedback", () => {
  it("portal/useMarcarNotificacionLeida invalida la key y no dispara toast por defecto", async () => {
    marcarNotificacionLeida.mockResolvedValueOnce(undefined);
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useMarcarNotificacionLeida(), { wrapper: Wrapper });
    result.current.mutate("n1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(marcarNotificacionLeida).toHaveBeenCalled();
    expect(marcarNotificacionLeida.mock.calls[0][0]).toBe("n1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["portal", "notificaciones"] });
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("portal/useMarcarTodasLeidas reporta el errorTitle configurado si falla", async () => {
    marcarTodasNotificacionesLeidas.mockRejectedValueOnce(new Error("boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMarcarTodasLeidas(), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError.mock.calls[0][1]).toMatchObject({
      title: "Error al marcar notificaciones",
      method: "MARK_ALL_NOTIF_READ",
    });
  });

  it("notificaciones internas/marcarLeida propaga el errorMethod correcto", async () => {
    svcMarcarLeida.mockRejectedValueOnce(new Error("fail"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotificacionesInternas(), { wrapper: Wrapper });
    result.current.marcarLeida("n1");
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][1]).toMatchObject({
      title: "Error al marcar notificación",
      method: "MARK_INTERNAL_NOTIF_READ",
    });
  });

  it("useSnoozeHallazgo rechaza fechas en el pasado sin llamar al servicio", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSnoozeHallazgo(), { wrapper: Wrapper });
    result.current.mutate({
      hallazgo: {
        embarque_id: "e1",
        regla: "R1",
        detalle: {},
        severidad: "alta",
        expediente: "EXP-1",
        cliente_nombre: "ACME",
      } as never,
      snoozedUntil: "2000-01-01",
      motivo: "x",
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(snoozeRevision).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError.mock.calls[0][1]).toMatchObject({
      title: "No se pudo silenciar el hallazgo",
    });
  });

  it("useQuitarSnooze muestra toast success con el título configurado", async () => {
    clearSnoozeRevision.mockResolvedValueOnce(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useQuitarSnooze(), { wrapper: Wrapper });
    result.current.mutate({ embarque_id: "e1", regla: "R1", detalle_hash: "h" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifySuccess.mock.calls[0][1]).toMatchObject({ title: "Snooze removido" });
  });
});
