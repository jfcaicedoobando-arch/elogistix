/**
 * Regresión — actualizar, eliminar, tomar y calificar leads deben invalidar
 * `crm.dashboardAll` (igual que crear) para que el resumen ejecutivo refleje
 * cartera/embudo sin esperar el staleTime de 60s del dashboard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const updateLead = vi.hoisted(() => vi.fn());
const softDeleteLead = vi.hoisted(() => vi.fn());
const tomarLead = vi.hoisted(() => vi.fn());
const calificarProspecto = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services/leads", () => ({
  createLead: vi.fn(),
  updateLead,
  softDeleteLead,
  tomarLead,
  calificarProspecto,
  mensajeErrorCalificar: (e: Error) => e.message,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "kam@example.com" } }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    crm: {
      leads: { all: ["crm", "leads"], detail: (id: string) => ["crm", "leads", id] },
      prospectos: { all: ["crm", "prospectos"] },
      kpis: ["crm", "kpis"],
      dashboardAll: ["crm", "dashboard"],
    },
  },
}));

import {
  useActualizarLead,
  useEliminarLead,
  useTomarLead,
  useCalificarProspecto,
} from "../leads/mutations";

function spyClient() {
  const client = (globalThis as unknown as {
    __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
  }).__TEST_QUERY_CLIENT__;
  return vi.spyOn(client, "invalidateQueries");
}

const keys = (spy: ReturnType<typeof spyClient>) =>
  spy.mock.calls.map((args) => (args[0] as { queryKey: unknown }).queryKey);

describe("invalidación del dashboard en mutaciones de leads", () => {
  beforeEach(() => {
    updateLead.mockReset().mockResolvedValue({ id: "lead-1" });
    softDeleteLead.mockReset().mockResolvedValue(undefined);
    tomarLead.mockReset().mockResolvedValue({ id: "lead-1" });
    calificarProspecto.mockReset().mockResolvedValue({ id: "lead-1" });
  });

  it("actualizar lead invalida listas, detalle, kpis y dashboard", async () => {
    const { result } = renderHook(() => useActualizarLead(), { wrapper: createWrapper() });
    const spy = spyClient();
    result.current.mutate({ id: "lead-1", patch: { estado: "contactado" } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "leads"]);
    expect(invalidated).toContainEqual(["crm", "leads", "lead-1"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });

  it("eliminar lead invalida listas, kpis y dashboard", async () => {
    const { result } = renderHook(() => useEliminarLead(), { wrapper: createWrapper() });
    const spy = spyClient();
    result.current.mutate("lead-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "leads"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });

  it("tomar lead invalida listas, detalle, kpis y dashboard", async () => {
    const { result } = renderHook(() => useTomarLead(), { wrapper: createWrapper() });
    const spy = spyClient();
    result.current.mutate({ id: "lead-1", empresa: "ACME" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "leads"]);
    expect(invalidated).toContainEqual(["crm", "leads", "lead-1"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });

  it("calificar prospecto invalida listas, detalle, kpis y dashboard", async () => {
    const { result } = renderHook(() => useCalificarProspecto(), { wrapper: createWrapper() });
    const spy = spyClient();
    result.current.mutate("lead-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "leads"]);
    expect(invalidated).toContainEqual(["crm", "leads", "lead-1"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });
});
