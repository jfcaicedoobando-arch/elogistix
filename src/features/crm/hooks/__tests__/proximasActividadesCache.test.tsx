import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/query";
import type { CrmEntidadTipo, ProximaActividad } from "@/features/crm/types/actividades";

const mocks = vi.hoisted(() => ({
  crear: vi.fn(), completar: vi.fn(), posponer: vi.fn(), mover: vi.fn(),
  automatizar: vi.fn(), proximas: vi.fn(), success: vi.fn(), warning: vi.fn(),
}));
vi.mock("@/features/crm/services/actividades", () => ({
  crearActividad: mocks.crear, completarActividad: mocks.completar,
  posponerActividad: mocks.posponer,
}));
vi.mock("@/features/crm/services/oportunidades", () => ({ moverEtapaOportunidad: mocks.mover }));
vi.mock("@/features/crm/services/automatizacionesEtapa", () => ({ runAutomatizaciones: mocks.automatizar }));
vi.mock("@/features/crm/services/proximasActividades", () => ({ fetchProximasActividades: mocks.proximas }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-1", email: "u@example.test" } }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyWarning: mocks.warning, notifyError: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn() } }));

import { useCrearActividad, useCompletarActividad, usePosponerActividad } from "../useActividades";
import { useMoverEtapaConAutomatizacion } from "../useAutomatizacionesEtapa";
import { useProximasActividades } from "../useProximasActividades";

const clients: QueryClient[] = [];
function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return client;
}
function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function next(tipo: CrmEntidadTipo, version: string) {
  return new Map<string, ProximaActividad>([["entidad-1", {
    id: version, entidad_tipo: tipo, entidad_id: "entidad-1", tipo: "tarea",
    asunto: version, fecha_programada: "2026-10-15T15:00:00Z",
  }]]);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.crear.mockResolvedValue({ id: "creada" });
  mocks.completar.mockResolvedValue(undefined);
  mocks.posponer.mockResolvedValue(undefined);
  mocks.mover.mockResolvedValue({ updatedAt: "2026-10-12T10:00:00Z", avisoActividad: null });
  mocks.automatizar.mockResolvedValue(undefined);
});
afterEach(async () => {
  cleanup();
  for (const client of clients.splice(0)) { await client.cancelQueries(); client.clear(); }
});

const cases = [
  { name: "crear", kind: "crear", incomplete: false },
  { name: "completar", kind: "completar", incomplete: false },
  { name: "posponer", kind: "posponer", incomplete: false },
  { name: "cambiar etapa", kind: "etapa", incomplete: false },
  { name: "cambiar etapa con automatización incompleta", kind: "etapa", incomplete: true },
] as const;

describe("próximas actividades con caché fresca y observadores reales", () => {
  it("al cambiar el tipo de entidad no reutiliza actividades del tipo anterior", async () => {
    const client = createClient();
    client.setQueryData(queryKeys.crm.proximasActividades("oportunidad", ["entidad-1"]), next("oportunidad", "anterior"));
    const gate = deferred();
    mocks.proximas.mockImplementation(async () => { await gate.promise; return next("cliente", "actualizada"); });
    const observed = renderHook(({ tipo }: { tipo: CrmEntidadTipo }) => useProximasActividades(tipo, ["entidad-1"]), {
      wrapper: wrapper(client), initialProps: { tipo: "oportunidad" },
    });
    observed.rerender({ tipo: "cliente" });
    try {
      await waitFor(() => expect(mocks.proximas).toHaveBeenCalledTimes(1));
      expect(observed.result.current.data).toBeUndefined();
      expect(observed.result.current.isPending).toBe(true);
      await act(async () => { gate.resolve(); await gate.promise; });
      await waitFor(() => expect(observed.result.current.data?.get("entidad-1")?.entidad_tipo).toBe("cliente"));
    } finally { await act(async () => { gate.resolve(); }); }
  });

  it.each(cases)("$name refresca los lotes y espera su lectura", async ({ kind, incomplete }) => {
    const client = createClient();
    const tipos = ["oportunidad", "lead", "cliente"] as const;
    for (const tipo of tipos) client.setQueryData(queryKeys.crm.proximasActividades(tipo, ["entidad-1"]), next(tipo, "anterior"));
    const unaffected = ["crm", "consulta-no-afectada"] as const;
    client.setQueryData(unaffected, "conservar");
    const gate = deferred();
    mocks.proximas.mockImplementation(async (tipo: CrmEntidadTipo) => {
      await gate.promise;
      return next(tipo, "actualizada");
    });
    if (incomplete) mocks.automatizar.mockRejectedValueOnce(new Error("Seguimiento incompleto"));
    const observed = renderHook(() => ({
      oportunidad: useProximasActividades("oportunidad", ["entidad-1"]),
      lead: useProximasActividades("lead", ["entidad-1"]),
      cliente: useProximasActividades("cliente", ["entidad-1"]),
    }), { wrapper: wrapper(client) });
    const mutations = renderHook(() => ({
      crear: useCrearActividad(), completar: useCompletarActividad(),
      posponer: usePosponerActividad(), etapa: useMoverEtapaConAutomatizacion(),
    }), { wrapper: wrapper(client) });
    expect(mocks.proximas).not.toHaveBeenCalled();
    for (const tipo of tipos) expect(observed.result.current[tipo].isStale).toBe(false);
    let settled = false;
    let pending: Promise<unknown> | undefined;
    try {
      act(() => {
        if (kind === "crear") pending = mutations.result.current.crear.mutateAsync({
          tipo: "tarea", asunto: "Seguimiento", entidad_tipo: "oportunidad", entidad_id: "entidad-1", silencioso: true,
        });
        if (kind === "completar") pending = mutations.result.current.completar.mutateAsync({ id: "anterior", resultado: "Hecho" });
        if (kind === "posponer") pending = mutations.result.current.posponer.mutateAsync({ id: "anterior", dias: 2, fechaProgramada: null });
        if (kind === "etapa") pending = mutations.result.current.etapa.mutateAsync({ id: "entidad-1", etapa_id: "etapa-2", expectedUpdatedAt: "sello" });
        void pending?.then(() => { settled = true; });
      });
      await waitFor(() => expect(mocks.proximas).toHaveBeenCalledTimes(3), { timeout: 700 });
      expect(settled).toBe(false);
      expect(mutations.result.current[kind].isPending).toBe(true);
      for (const tipo of tipos) {
        expect(mocks.proximas).toHaveBeenCalledWith(tipo, ["entidad-1"]);
        expect(observed.result.current[tipo].data?.get("entidad-1")?.id).toBe("anterior");
      }
      await act(async () => { gate.resolve(); await pending; });
      await waitFor(() => {
        for (const tipo of tipos) expect(observed.result.current[tipo].data?.get("entidad-1")?.id).toBe("actualizada");
      });
      expect(settled).toBe(true);
      expect(client.getQueryState(unaffected)?.isInvalidated).toBe(false);
      if (kind === "crear") {
        expect(mocks.crear).toHaveBeenCalledWith({ tipo: "tarea", asunto: "Seguimiento", entidad_tipo: "oportunidad", entidad_id: "entidad-1" }, { id: "u-1", email: "u@example.test" });
        expect(mocks.success).not.toHaveBeenCalled();
      }
      if (kind === "completar") expect(mocks.completar).toHaveBeenCalledWith({ id: "anterior", resultado: "Hecho" }, expect.anything());
      if (kind === "posponer") expect(mocks.posponer).toHaveBeenCalledWith({ id: "anterior", dias: 2, fechaProgramada: null }, expect.anything());
      if (kind === "etapa") {
        expect(mocks.mover).toHaveBeenCalledWith({ id: "entidad-1", etapa_id: "etapa-2", expectedUpdatedAt: "sello" });
        expect(mocks.automatizar).toHaveBeenCalledWith("etapa-2", "entidad-1", "u-1", "u@example.test");
        expect(mocks.warning).toHaveBeenCalledTimes(incomplete ? 1 : 0);
      }
    } finally {
      await act(async () => { gate.resolve(); await pending; });
    }
  });
});
