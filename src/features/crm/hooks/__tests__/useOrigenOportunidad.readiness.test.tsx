import { useState, type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crm } from "@/features/crm/queryKeys";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";
import type { OrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";
import type { CrmOportunidadRow } from "../useOportunidades";
import { useOrigenClienteForzado } from "../useOrigenClienteForzado";
import { useNuevaOportunidadSubmit } from "../useNuevaOportunidadSubmit";
import { useOportunidadForm } from "../useOportunidadForm";

const crear = vi.fn(async () => ({ id: "op" }));
const actualizar = vi.fn(async () => ({}));
const fetchOrigen = vi.fn<(id: string) => Promise<OrigenEmpresa>>();
vi.mock("@/features/crm/hooks", () => ({
  useCrearOportunidad: () => ({ mutateAsync: crear, isPending: false }),
  useActualizarOportunidad: () => ({ mutateAsync: actualizar, isPending: false }),
  useCrearActividad: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/crm/services/origenEmpresaCrm", () => ({
  fetchOrigenEmpresa: (id: string) => fetchOrigen(id),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
vi.mock("@/features/crm/lib/crmToast", () => ({ crmToast: { success: vi.fn() } }));

function diferido() {
  let resolve!: (value: OrigenEmpresa) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<OrigenEmpresa>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const cliente = (id: string): OrigenEmpresa => ({ ok: true, origen: { tipo: "cliente", id, nombre: id } });
const manual = {
  ...EMPTY_OPORTUNIDAD, nombre: "Operación", empresa_id: "A", empresa_nombre: "Empresa A",
  etapa_id: "etapa", lead_id: "lead-manual", lead_nombre: "Manual calificado",
};
function contexto(qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  return { qc, wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> };
}
function montar() {
  const ctx = contexto();
  const hook = renderHook(({ open, edit }) => {
    const [form, setForm] = useState<OportunidadFormState>(manual);
    const origen = useOrigenClienteForzado(form, open && !edit, setForm);
    const submit = useNuevaOportunidadSubmit({ form, origenEmpresa: origen, esGanada: false,
      isEdit: edit, oportunidad: edit ? { id: "historica" } as CrmOportunidadRow : null,
      autoActividad: false, markClean: vi.fn(), onOpenChange: vi.fn() });
    return { form, setForm, origen, ...submit };
  }, { wrapper: ctx.wrapper, initialProps: { open: true, edit: false } });
  return { ...hook, qc: ctx.qc };
}

describe("origen de creación: consulta compartida + submit real", () => {
  beforeEach(() => { crear.mockClear(); actualizar.mockClear(); fetchOrigen.mockReset(); });

  it("pendiente no envía; B resuelve antes de A y late A no toca B", async () => {
    const a = diferido(), b = diferido();
    fetchOrigen.mockImplementation(id => id === "A" ? a.promise : b.promise);
    const { result } = montar();
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).not.toHaveBeenCalled();
    act(() => result.current.setForm(f => ({ ...f, empresa_id: "B", lead_id: null, lead_nombre: "" })));
    await act(async () => b.resolve(cliente("cliente-B")));
    await waitFor(() => expect(result.current.origen.listo).toBe(true));
    expect(result.current.form).toMatchObject({ empresa_id: "B", cliente_id: "cliente-B", lead_id: null });
    await act(async () => a.resolve(cliente("cliente-A")));
    expect(result.current.form.cliente_id).toBe("cliente-B");
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ empresa_id: "B", cliente_id: "cliente-B", lead_id: null }));
  });

  it("cliente forzado elimina lead y etiquetas aunque el cliente ya coincida", async () => {
    fetchOrigen.mockResolvedValue(cliente("cliente-A"));
    const { result } = montar();
    act(() => result.current.setForm(f => ({ ...f, origen_tipo: "cliente", cliente_id: "cliente-A", cliente_nombre: "Viejo" })));
    await waitFor(() => expect(result.current.origen.listo).toBe(true));
    expect(result.current.form).toMatchObject({ cliente_nombre: "cliente-A", lead_id: null, lead_nombre: "" });
  });

  it("error bloquea incluso con caché; reintento exitoso sin cliente conserva manual", async () => {
    fetchOrigen.mockRejectedValueOnce(new Error("Sin conexión"));
    const { result, qc } = montar();
    await waitFor(() => expect(result.current.origen.error).toBe(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).not.toHaveBeenCalled();
    expect(result.current.form.lead_id).toBe("lead-manual");
    fetchOrigen.mockResolvedValue({ ok: false, motivo: "Sin origen automático" });
    act(() => result.current.origen.reintentar());
    await waitFor(() => expect(result.current.origen.listo).toBe(true));
    expect(qc.getQueryState(crm.origenEmpresa("A"))?.status).toBe("success");
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ lead_id: "lead-manual", cliente_id: null }));
  });

  it("el lead automático distinto no reemplaza la selección manual de empresa sin cliente", async () => {
    fetchOrigen.mockResolvedValue({ ok: true, origen: { tipo: "prospecto", id: "otro-lead", nombre: "Otro" } });
    const { result } = montar();
    await waitFor(() => expect(result.current.origen.listo).toBe(true));
    expect(result.current.form.lead_id).toBe("lead-manual");
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ lead_id: "lead-manual" }));
  });

  it("un cliente ligado no disponible tampoco habilita la selección manual ni el submit", async () => {
    fetchOrigen.mockResolvedValue({ ok: false, motivo: "Cliente no disponible", clienteId: "cliente-eliminado" });
    const { result } = montar();
    await waitFor(() => expect(result.current.origen.clienteForzado).toBe(true));
    expect(result.current.origen.listo).toBe(false);
    expect(result.current.origen.mensaje).toBe("Cliente no disponible");
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).not.toHaveBeenCalled();
  });

  it("cache + refetch bloquea también antes del render y al fallar", async () => {
    fetchOrigen.mockResolvedValue(cliente("cliente-A"));
    const { result, qc } = montar();
    await waitFor(() => expect(result.current.origen.listo).toBe(true));
    const next = diferido(); fetchOrigen.mockReturnValue(next.promise);
    await act(async () => {
      void qc.invalidateQueries({ queryKey: crm.origenEmpresa("A") });
      await result.current.handleSubmit();
    });
    expect(crear).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.origen.listo).toBe(false));
    await act(async () => next.reject(new Error("Sin conexión")));
    await waitFor(() => expect(result.current.origen.error).toBe(true));
    await act(async () => { await result.current.handleSubmit(); });
    expect(crear).not.toHaveBeenCalled();
  });

  it("cerrado y edición no hidratan ni alteran el origen histórico", async () => {
    const a = diferido(); fetchOrigen.mockReturnValue(a.promise);
    const { result, rerender } = montar();
    rerender({ open: false, edit: false });
    await act(async () => a.resolve(cliente("cliente-A")));
    expect(result.current.form).toEqual(manual);
    rerender({ open: true, edit: true });
    act(() => result.current.setForm(f => ({ ...f, cliente_id: "hist-cliente", cliente_nombre: "Histórico" })));
    await act(async () => { await result.current.handleSubmit(); });
    expect(fetchOrigen).toHaveBeenCalledTimes(1);
    expect(actualizar).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({
      lead_id: "lead-manual", cliente_id: "hist-cliente",
    }) }));
  });

  it("cerrar/reabrir inicializa el nuevo borrador y verifica de nuevo el caché", async () => {
    const ctx = contexto();
    const etapas = [{ id: "etapa", probabilidad_default: 10, tipo: "abierta" }];
    fetchOrigen.mockResolvedValue(cliente("cliente-A"));
    const { result, rerender } = renderHook(({ open, empresaId }) => {
      const estado = useOportunidadForm(open, null, etapas, null, { empresa: { id: empresaId, nombre: empresaId } });
      return { ...estado, origen: useOrigenClienteForzado(estado.form, open, estado.setForm) };
    }, { wrapper: ctx.wrapper, initialProps: { open: true, empresaId: "A" } });
    await waitFor(() => expect(result.current.form.cliente_id).toBe("cliente-A"));
    rerender({ open: false, empresaId: "A" });
    const next = diferido(); fetchOrigen.mockReturnValue(next.promise);
    rerender({ open: true, empresaId: "B" });
    expect(result.current.form).toMatchObject({ empresa_id: "B", cliente_id: null, lead_id: null });
    expect(result.current.origen.listo).toBe(false);
    await act(async () => next.resolve(cliente("cliente-B")));
    await waitFor(() => expect(result.current.form.cliente_id).toBe("cliente-B"));
  });
});
