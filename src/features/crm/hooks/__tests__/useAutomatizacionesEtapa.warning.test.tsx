/**
 * v13.823.140 — El movimiento de etapa nunca se revierte, pero si alguna
 * automatización falla el usuario debe verlo: warning claro + resultado que
 * distingue "movido y automatizado" de "movido con automatización incompleta".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { moverMock, runMock, notifyWarningMock, notifyErrorMock, warnMock } = vi.hoisted(() => ({
  moverMock: vi.fn(async () => "2026-09-05T10:00:00.000Z"),
  runMock: vi.fn(async () => undefined),
  notifyWarningMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@/features/crm/services/oportunidades", () => ({ moverEtapaOportunidad: moverMock }));
vi.mock("@/features/crm/services/automatizacionesEtapa", () => ({ runAutomatizaciones: runMock }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: notifyWarningMock, notifyError: notifyErrorMock }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: warnMock, error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "u@x.com" } }),
}));

import { useMoverEtapaConAutomatizacion } from "../useAutomatizacionesEtapa";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const params = { id: "op-1", etapa_id: "e-2" };

beforeEach(() => {
  moverMock.mockClear();
  runMock.mockClear();
  notifyWarningMock.mockClear();
  notifyErrorMock.mockClear();
  warnMock.mockClear();
});

describe("useMoverEtapaConAutomatizacion — automatización incompleta", () => {
  it("movimiento exitoso + automatización fallida: avisa, no revierte y marca automatizacionesOk=false", async () => {
    runMock.mockRejectedValueOnce(new Error("No se pudo crear la tarea de seguimiento: rls"));
    const { result } = renderHook(() => useMoverEtapaConAutomatizacion(), { wrapper });

    let salida: { automatizacionesOk: boolean } | undefined;
    await act(async () => {
      salida = (await result.current.mutateAsync(params)) as { automatizacionesOk: boolean };
    });

    expect(moverMock).toHaveBeenCalledTimes(1);
    expect(salida?.automatizacionesOk).toBe(false);
    expect(notifyErrorMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
    const arg = notifyWarningMock.mock.calls[0][1] as { title: string; description: string };
    expect(arg.title).toContain("Etapa actualizada");
    expect(arg.description).toContain("Revisa actividades");
  });

  it("movimiento y automatización exitosos: sin warning y automatizacionesOk=true", async () => {
    const { result } = renderHook(() => useMoverEtapaConAutomatizacion(), { wrapper });

    let salida: { automatizacionesOk: boolean } | undefined;
    await act(async () => {
      salida = (await result.current.mutateAsync(params)) as { automatizacionesOk: boolean };
    });

    expect(salida?.automatizacionesOk).toBe(true);
    expect(notifyWarningMock).not.toHaveBeenCalled();
  });
});
