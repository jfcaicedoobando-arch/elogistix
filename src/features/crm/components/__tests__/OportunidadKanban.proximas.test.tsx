import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { ProximaActividad } from "@/features/crm/types/actividades";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/crm/services/proximasActividades", () => ({ fetchProximasActividades: fetchMock }));
vi.mock("@/features/crm/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/features/crm/hooks/useProximasActividades")>("@/features/crm/hooks/useProximasActividades");
  return { useProximasActividades: actual.useProximasActividades };
});
vi.mock("@/features/crm/hooks/useCriteriosEtapa", () => ({ useAvanceCriterios: () => ({ data: new Map() }) }));

import OportunidadKanban from "../OportunidadKanban";

const etapa: CrmEtapaRow = {
  id: "etapa-1", nombre: "Calificación", tipo: "abierta", color: "", probabilidad_default: 50,
  activa: true, crea_tarea_seguimiento: true, dias_seguimiento: 3, orden: 1,
  created_at: "", updated_at: "", deleted_at: null, deleted_by: null,
  organization_id: "org-sintetica", sla_dias: null,
};
function op(id = "op-1", etapaId = etapa.id): CrmOportunidadRow {
  return { id, etapa_id: etapaId, nombre: `Oportunidad ${id}`, monto_estimado: 100, moneda: "MXN", probabilidad: 50 } as CrmOportunidadRow;
}
function known() {
  return new Map<string, ProximaActividad>([["op-1", {
    id: "actividad-1", entidad_tipo: "oportunidad", entidad_id: "op-1", tipo: "tarea",
    asunto: "Seguimiento conservado", fecha_programada: null,
  }]]);
}
function deferred() {
  let resolve!: (value: Map<string, ProximaActividad>) => void;
  const promise = new Promise<Map<string, ProximaActividad>>((done) => { resolve = done; });
  return { promise, resolve };
}
const clients: QueryClient[] = [];
function mount(ops = [op()], initial?: Map<string, ProximaActividad>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  if (initial) client.setQueryData(queryKeys.crm.proximasActividades("oportunidad", ops.map(o => o.id).sort()), initial);
  const view = (items: CrmOportunidadRow[]) => <QueryClientProvider client={client}>
    <OportunidadKanban etapas={[etapa]} oportunidades={items} onMover={vi.fn()} onClickCard={vi.fn()} />
  </QueryClientProvider>;
  const rendered = render(view(ops));
  return { client, rerender: (items: CrmOportunidadRow[]) => rendered.rerender(view(items)) };
}
beforeEach(() => { fetchMock.mockReset(); });
afterEach(async () => {
  cleanup();
  for (const client of clients.splice(0)) { await client.cancelQueries(); client.clear(); }
});

describe("Kanban: presencia, ausencia confirmada y lectura no disponible", () => {
  it.each(["etapa-1", "etapa-inexistente"])("carga diferida en %s no afirma ausencia", async (etapaId) => {
    const gate = deferred();
    fetchMock.mockReturnValue(gate.promise);
    mount([op("op-1", etapaId)]);
    try {
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByText("Sin próxima acción")).not.toBeInTheDocument();
      expect(screen.getAllByRole("status").some(s => /(Cargando|Actualizando) próximas/.test(s.textContent ?? ""))).toBe(true);
      await act(async () => { gate.resolve(known()); await gate.promise; });
      expect(await screen.findByText("Seguimiento conservado")).toBeInTheDocument();
    } finally { await act(async () => { gate.resolve(known()); }); }
  });

  it("error inicial muestra alerta accesible y reintento sin afirmar ausencia", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Lectura fallida"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/próximas actividades/i);
    expect(screen.queryByText("Sin próxima acción")).not.toBeInTheDocument();
    expect(screen.getByText("Próxima actividad no disponible")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(known());
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Seguimiento conservado")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("vacío exitoso sí confirma Sin próxima acción", async () => {
    fetchMock.mockResolvedValueOnce(new Map());
    mount();
    expect(await screen.findByText("Sin próxima acción")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("al cambiar el lote conserva una actividad conocida mientras consulta los nuevos ids", async () => {
    const gate = deferred();
    fetchMock.mockReturnValueOnce(gate.promise);
    const rendered = mount([op()], known());
    expect(fetchMock).not.toHaveBeenCalled();
    rendered.rerender([op(), op("op-2")]);
    try {
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("oportunidad", ["op-1", "op-2"]));
      expect(screen.getByText("Seguimiento conservado")).toBeInTheDocument();
      expect(screen.queryByText("Sin próxima acción")).not.toBeInTheDocument();
      expect(screen.getAllByRole("status").some(s => /(Cargando|Actualizando) próximas/.test(s.textContent ?? ""))).toBe(true);
      await act(async () => { gate.resolve(new Map()); await gate.promise; });
      await waitFor(() => expect(screen.getAllByText("Sin próxima acción")).toHaveLength(2));
    } finally { await act(async () => { gate.resolve(new Map()); }); }
  });

  it("refetch con error conserva datos conocidos y no declara ausencia para los demás", async () => {
    const gate = deferred();
    fetchMock.mockImplementationOnce(async () => { await gate.promise; throw new Error("No disponible"); });
    const { client } = mount([op(), op("op-2")], known());
    expect(screen.getByText("Sin próxima acción")).toBeInTheDocument();
    let refreshing: Promise<void> | undefined;
    try {
      act(() => { refreshing = client.invalidateQueries({ queryKey: queryKeys.crm.proximasActividades("oportunidad", ["op-1", "op-2"]) }); });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(screen.getByText("Seguimiento conservado")).toBeInTheDocument();
      expect(screen.queryByText("Sin próxima acción")).not.toBeInTheDocument();
      await act(async () => { gate.resolve(new Map()); await refreshing; });
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Seguimiento conservado")).toBeInTheDocument();
      expect(screen.queryByText("Sin próxima acción")).not.toBeInTheDocument();
      expect(screen.getByText("Próxima actividad no disponible")).toBeInTheDocument();
    } finally { await act(async () => { gate.resolve(new Map()); await refreshing; }); }
  });
});
