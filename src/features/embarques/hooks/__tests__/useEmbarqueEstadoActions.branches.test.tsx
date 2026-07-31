/**
 * Tests de branch coverage para useEmbarqueEstadoActions.
 * Cubre las ramas que el suite base no toca: bloqueo por docs, gate de cierre
 * (rol y checklist), confirmaciones, sync auto de estado, error en reabrir,
 * y conteo de conceptos sin proforma.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const h = vi.hoisted(() => ({
  avanzar: vi.fn(),
  reabrir: vi.fn(),
  sync: vi.fn(),
  calcEstado: vi.fn(),
  conceptos: [] as Array<{ estado_facturacion: string }>,
  docs: { faltantes: [] as string[], bloqueante: false, loading: false },
  perms: { isAdmin: false, canEditFinance: false, canEditOperations: false, isSuperAdmin: false },
  validacion: { data: undefined as undefined | { puede_cerrar: boolean } },
  sonnerSuccess: vi.fn(),
  sonnerError: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  registrar: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: h.sonnerSuccess, error: h.sonnerError, warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "u@x.com" } }),
}));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: h.registrar }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => h.notifyError(...args),
  notifySuccess: (...args: unknown[]) => h.notifySuccess(...args),
}));
vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useAvanzarEstadoEmbarque: () => ({ mutateAsync: h.avanzar, isPending: false }),
  useReabrirEmbarque: () => ({ mutateAsync: h.reabrir, isPending: false }),
  useSyncEstadoEmbarque: () => ({ mutate: h.sync }),
  calcularEstadoEmbarque: (...args: unknown[]) => h.calcEstado(...args),
}));
vi.mock("@/features/embarques/hooks/useEmbarqueQueries", () => ({
  useEmbarqueConceptosVenta: () => ({ data: h.conceptos }),
}));
vi.mock("@/features/embarques/hooks/useDocsFaltantesParaEstado", () => ({
  useDocsFaltantesParaEstado: () => h.docs,
  esEstadoBloqueante: () => h.docs.bloqueante,
}));
vi.mock("@/features/embarques/hooks/useCierreEmbarque", () => ({
  useValidacionCierre: () => h.validacion,
}));
vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => h.perms,
}));

import { useEmbarqueEstadoActions } from "../useEmbarqueEstadoActions";

type EmbarqueArg = Parameters<typeof useEmbarqueEstadoActions>[0];
const base = {
  id: "e-1", modo: "Marítimo", tipo: "FCL",
  etd: null, eta: null, estado: "Confirmado", expediente: "EXP-001",
} as unknown as EmbarqueArg & { estado: string };

function renderH(emb: Partial<typeof base> = {}, id: string | undefined = "e-1") {
  return renderHook(
    () => useEmbarqueEstadoActions({ ...base, ...emb } as EmbarqueArg, id),
    { wrapper: createWrapper() },
  );
}

beforeEach(() => {
  h.avanzar.mockReset().mockResolvedValue({});
  h.reabrir.mockReset().mockResolvedValue({});
  h.sync.mockReset();
  h.calcEstado.mockReset().mockImplementation((_m, _t, _e, _a, estado) => estado);
  h.conceptos = [];
  h.docs = { faltantes: [], bloqueante: false, loading: false };
  h.perms = { isAdmin: false, canEditFinance: false, canEditOperations: false, isSuperAdmin: false };
  h.validacion = { data: undefined };
  h.sonnerSuccess.mockReset(); h.sonnerError.mockReset();
  h.notifyError.mockReset(); h.notifySuccess.mockReset();
  h.registrar.mockReset();
});

describe("useEmbarqueEstadoActions — early returns", () => {
  it("handleAvanzarEstado no hace nada si no hay embarque", async () => {
    const { result } = renderHook(
      () => useEmbarqueEstadoActions(undefined, "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(h.avanzar).not.toHaveBeenCalled();
  });

  it("handleAvanzarEstado no hace nada si siguiente=null (estado Cerrado)", async () => {
    const { result } = renderH({ estado: "Cerrado" });
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(h.avanzar).not.toHaveBeenCalled();
  });

  it("handleReabrir no hace nada si no hay id", async () => {
    const { result } = renderHook(
      () => useEmbarqueEstadoActions({ ...base } as EmbarqueArg, undefined),
      { wrapper: createWrapper() },
    );
    await act(async () => { await result.current.handleReabrir("Motivo de prueba suficientemente largo"); });
    expect(h.reabrir).not.toHaveBeenCalled();
  });
});

describe("useEmbarqueEstadoActions — candado de documentos", () => {
  it("abre blockDocsOpen cuando docs son bloqueantes y faltan", async () => {
    h.docs = { faltantes: ["BL"], bloqueante: true, loading: false };
    const { result } = renderH();
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(result.current.blockDocsOpen).toBe(true);
    expect(h.avanzar).not.toHaveBeenCalled();
  });

  it("abre warnDocsOpen cuando faltan docs no bloqueantes", async () => {
    h.docs = { faltantes: ["X"], bloqueante: false, loading: false };
    const { result } = renderH();
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(result.current.warnDocsOpen).toBe(true);
    expect(h.avanzar).not.toHaveBeenCalled();
  });

  it("confirmarAvanceConDocsPendientes cierra warn y avanza", async () => {
    h.docs = { faltantes: ["X"], bloqueante: false, loading: false };
    const { result } = renderH();
    await act(async () => { await result.current.confirmarAvanceConDocsPendientes(); });
    await waitFor(() => expect(h.avanzar).toHaveBeenCalledTimes(1));
    expect(result.current.warnDocsOpen).toBe(false);
  });

  it("ejecutarAvance abre blockDocsOpen cuando backend devuelve documentos_faltantes", async () => {
    h.avanzar.mockRejectedValueOnce(new Error("documentos_faltantes: BL,Packing"));
    const { result } = renderH();
    await act(async () => { await result.current.handleAvanzarEstado(); });
    await waitFor(() => expect(result.current.blockDocsOpen).toBe(true));
    expect(h.notifyError).not.toHaveBeenCalled();
  });
});

describe("useEmbarqueEstadoActions — gate de cierre", () => {
  it("gate_cierre por rol: usuario sin permiso financiero no puede cerrar", async () => {
    h.perms = { isAdmin: false, canEditFinance: false, canEditOperations: false, isSuperAdmin: false };
    h.validacion = { data: { puede_cerrar: true } };
    const { result } = renderH({ estado: "Por liquidar" });
    expect(result.current.cierreEsSiguiente).toBe(true);
    expect(result.current.rolPuedeCerrar).toBe(false);
    expect(result.current.cierreMotivoBloqueo).toBe("rol");
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(h.notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "GATE_CERRAR_EMBARQUE" }),
    );
    expect(h.avanzar).not.toHaveBeenCalled();
  });

  it("gate_cierre por checklist: rol OK pero validacion bloquea", async () => {
    h.perms = { isAdmin: false, canEditFinance: true, canEditOperations: false, isSuperAdmin: false };
    h.validacion = { data: { puede_cerrar: false } };
    const { result } = renderH({ estado: "Por liquidar" });
    expect(result.current.cierreMotivoBloqueo).toBe("checklist");
    await act(async () => { await result.current.handleAvanzarEstado(); });
    expect(h.avanzar).not.toHaveBeenCalled();
  });

  it("admin bypassea checklist incompleto y avanza a Cerrado", async () => {
    h.perms = { isAdmin: true, canEditFinance: false, canEditOperations: false, isSuperAdmin: false };
    h.validacion = { data: { puede_cerrar: false } };
    const { result } = renderH({ estado: "Por liquidar" });
    expect(result.current.cierrePuedeAvanzar).toBe(true);
    await act(async () => { await result.current.handleAvanzarEstado(); });
    await waitFor(() => expect(h.avanzar).toHaveBeenCalledTimes(1));
  });

  it("confirmarCierreSinProforma cierra dialog y dispara avance a Cerrado", async () => {
    h.perms = { isAdmin: true, canEditFinance: true, canEditOperations: true, isSuperAdmin: false };
    const { result } = renderH({ estado: "Por liquidar" });
    await act(async () => { await result.current.confirmarCierreSinProforma(); });
    await waitFor(() => expect(h.avanzar).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoEstado: "Cerrado" }),
    ));
    expect(result.current.warnCierreOpen).toBe(false);
  });
});

describe("useEmbarqueEstadoActions — sync automático", () => {
  it("dispara syncEstado cuando el estado calculado difiere del actual", async () => {
    h.perms = { isAdmin: false, canEditFinance: false, canEditOperations: true, isSuperAdmin: false };
    h.calcEstado.mockReturnValue("En Tránsito");
    renderH({ estado: "Confirmado" });
    await waitFor(() => expect(h.sync).toHaveBeenCalledWith(
      expect.objectContaining({ embarqueId: "e-1", nuevoEstado: "En Tránsito" }),
    ));
  });

  it("NO dispara sync cuando el calculado coincide con el actual", async () => {
    h.perms = { isAdmin: true, canEditFinance: false, canEditOperations: true, isSuperAdmin: false };
    h.calcEstado.mockReturnValue("Confirmado");
    renderH({ estado: "Confirmado" });
    await new Promise((r) => setTimeout(r, 0));
    expect(h.sync).not.toHaveBeenCalled();
  });

  it("NO dispara sync cuando el usuario no tiene permisos (rol contador)", async () => {
    h.perms = { isAdmin: false, canEditFinance: false, canEditOperations: false, isSuperAdmin: false };
    h.calcEstado.mockReturnValue("En Tránsito");
    renderH({ estado: "Confirmado" });
    await new Promise((r) => setTimeout(r, 0));
    expect(h.sync).not.toHaveBeenCalled();
  });
});

describe("useEmbarqueEstadoActions — handleReabrir error y conceptos", () => {
  it("handleReabrir notifica error si mutateAsync rechaza", async () => {
    h.reabrir.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderH({ estado: "Cerrado" });
    await act(async () => { await result.current.handleReabrir("Motivo de prueba suficientemente largo"); });
    await waitFor(() => expect(h.notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ method: "HANDLE_REABRIR_EMBARQUE" }),
    ));
  });

  it("conceptosSinProforma cuenta los que no están en_proforma", () => {
    h.conceptos = [
      { estado_facturacion: "en_proforma" },
      { estado_facturacion: "pendiente" },
      { estado_facturacion: "facturado" },
    ];
    const { result } = renderH();
    expect(result.current.conceptosSinProforma).toBe(2);
  });
});
