/**
 * Pruebas del controlador de página de "Nueva cotización" (paso 6 auditoría).
 * Cubre: lectura de `?oportunidad=` y gating del prefill, onFinalized
 * (savedId + limpieza del borrador), autosave (enabled=true y pausa durante la
 * restauración), cierre/navegaciones del success dialog, estado de la plantilla
 * y propagación del conflicto de pestaña / resincronización del sello.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigateSpy,
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  usePermissions: () => ({ canCrearEmbarqueDesdeCotizacion: true }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
  useDocumentTitle: vi.fn(),
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({
  useOrgActiva: () => ({ organizationId: "org-1" }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "u@x.mx" } }),
}));
vi.mock("@/features/cliente/hooks", () => ({
  useClientesForSelect: () => ({ data: [{ id: "cli-1", nombre: "ACME" }] }),
}));

const wizardState = {
  form: { getValues: () => ({ prospectoEmpresa: "ACME" }) },
  cotizacionId: null as string | null,
  currentStep: 1,
  costosInternos: [],
  selloActual: null,
  setCotizacionId: vi.fn(),
  setCurrentStep: vi.fn(),
  setCostosInternos: vi.fn(),
  resincronizarSello: vi.fn(),
};
const wizardArgs: Record<string, unknown>[] = [];
vi.mock("@/features/cotizacion/hooks", () => ({
  useCreateCotizacion: () => ({ mutateAsync: vi.fn() }),
  useUpdateCotizacion: () => ({ mutateAsync: vi.fn() }),
  useUpsertCotizacionCostos: () => ({ mutateAsync: vi.fn() }),
  useCotizacionWizardForm: (args: Record<string, unknown>) => {
    wizardArgs.push(args);
    return wizardState;
  },
}));

const autosaveArgs: Record<string, unknown>[] = [];
const clearDraft = vi.fn();
const descartarConflicto = vi.fn();
const conflicto = { externo: false };
vi.mock("@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave", () => ({
  useCotizacionDraftAutosave: (args: Record<string, unknown>) => {
    autosaveArgs.push(args);
    return { flush: vi.fn(), conflictoExterno: conflicto.externo, descartarConflicto };
  },
  clearDraft: (...a: unknown[]) => clearDraft(...a),
}));

const prefillArgs: Record<string, unknown>[] = [];
vi.mock("@/features/cotizacion/hooks/wizard/usePrefillProspectoOportunidad", () => ({
  usePrefillProspectoOportunidad: (args: Record<string, unknown>) => { prefillArgs.push(args); },
}));

const draftRestore = {
  restaurando: false,
  draftDetectado: null as { savedAt: string } | null,
  banderaBorrador: false,
  conflictoSello: false,
  permitePrefillProspecto: true,
  resincronizando: false,
  handleResincronizar: vi.fn(),
  handleRestore: vi.fn(),
  handleDiscard: vi.fn(),
};
vi.mock("../useDraftRestore", () => ({
  useDraftRestore: () => draftRestore,
}));

import { useNuevaCotizacionPageController } from "../useNuevaCotizacionPageController";

const wrapper = (search = "") =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[{ pathname: "/cotizaciones/nueva", search }]}>
      {children}
    </MemoryRouter>
  );

const render = (search = "") =>
  renderHook(() => useNuevaCotizacionPageController(), { wrapper: wrapper(search) });

beforeEach(() => {
  vi.clearAllMocks();
  wizardArgs.length = 0;
  autosaveArgs.length = 0;
  prefillArgs.length = 0;
  wizardState.cotizacionId = null;
  wizardState.currentStep = 1;
  draftRestore.restaurando = false;
  draftRestore.permitePrefillProspecto = true;
  draftRestore.conflictoSello = false;
  draftRestore.draftDetectado = null;
  draftRestore.banderaBorrador = false;
  conflicto.externo = false;
});

describe("useNuevaCotizacionPageController — oportunidad y prefill", () => {
  it("sin ?oportunidad no habilita el prefill", () => {
    render();
    expect(prefillArgs.at(-1)).toMatchObject({ oportunidadId: null, enabled: false });
  });

  it("con ?oportunidad y permiso habilita el prefill", () => {
    render("?oportunidad=opp-9");
    expect(prefillArgs.at(-1)).toMatchObject({ oportunidadId: "opp-9", enabled: true });
  });

  it("no precarga si el borrador aún no se decidió", () => {
    draftRestore.permitePrefillProspecto = false;
    render("?oportunidad=opp-9");
    expect(prefillArgs.at(-1)?.enabled).toBe(false);
  });

  it("no precarga si ya existe cotizacionId", () => {
    wizardState.cotizacionId = "cot-1";
    render("?oportunidad=opp-9");
    expect(prefillArgs.at(-1)?.enabled).toBe(false);
  });
});

describe("useNuevaCotizacionPageController — success dialog y plantilla", () => {
  it("onFinalized guarda el id y limpia el borrador", () => {
    const { result } = render();
    const onFinalized = wizardArgs.at(-1)?.onFinalized as (id: string) => void;
    act(() => { onFinalized("cot-9"); });
    expect(result.current.savedId).toBe("cot-9");
    expect(clearDraft).toHaveBeenCalledWith("u1", "org-1");
  });

  it("cerrar el success sólo limpia savedId (sin navegar)", () => {
    const { result } = render();
    const onFinalized = wizardArgs.at(-1)?.onFinalized as (id: string) => void;
    act(() => { onFinalized("cot-9"); });
    act(() => { result.current.cerrarSuccess(); });
    expect(result.current.savedId).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("closeSuccessAndGoTo limpia savedId y navega a la ruta exacta", () => {
    const { result } = render();
    act(() => { result.current.closeSuccessAndGoTo("/cotizaciones/cot-9?enviarProforma=1"); });
    expect(result.current.savedId).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith("/cotizaciones/cot-9?enviarProforma=1");
  });

  it("irAlListado navega a /cotizaciones", () => {
    const { result } = render();
    act(() => { result.current.irAlListado(); });
    expect(navigateSpy).toHaveBeenCalledWith("/cotizaciones");
  });

  it("el diálogo de plantilla abre y cierra por estado", () => {
    const { result } = render();
    expect(result.current.guardarPlantillaOpen).toBe(false);
    act(() => { result.current.setGuardarPlantillaOpen(true); });
    expect(result.current.guardarPlantillaOpen).toBe(true);
    act(() => { result.current.setGuardarPlantillaOpen(false); });
    expect(result.current.guardarPlantillaOpen).toBe(false);
  });

  it("expone organización y usuario vigentes para guardar la plantilla", () => {
    const { result } = render();
    expect(result.current.organizationId).toBe("org-1");
    expect(result.current.userId).toBe("u1");
    expect(result.current.canCrearEmbarqueDesdeCotizacion).toBe(true);
  });
});

describe("useNuevaCotizacionPageController — autosave y conflictos", () => {
  it("el autosave queda siempre habilitado en alta y guarda id/paso/costos/sello", () => {
    wizardState.cotizacionId = "cot-1";
    wizardState.currentStep = 3;
    render();
    expect(autosaveArgs.at(-1)).toMatchObject({
      enabled: true,
      cotizacionId: "cot-1",
      currentStep: 3,
      paused: false,
      userId: "u1",
      organizationId: "org-1",
    });
    expect(autosaveArgs.at(-1)).toHaveProperty("selloActual");
    expect(autosaveArgs.at(-1)).toHaveProperty("costosInternos");
  });

  it("se pausa mientras se restaura el borrador", () => {
    draftRestore.restaurando = true;
    render();
    expect(autosaveArgs.at(-1)?.paused).toBe(true);
  });

  it("propaga el conflicto entre pestañas y su descarte", () => {
    conflicto.externo = true;
    const { result } = render();
    expect(result.current.conflictoExterno).toBe(true);
    act(() => { result.current.descartarConflicto(); });
    expect(descartarConflicto).toHaveBeenCalled();
  });

  it("propaga el conflicto de sello y su resincronización", () => {
    draftRestore.conflictoSello = true;
    const { result } = render();
    expect(result.current.conflictoSello).toBe(true);
    act(() => { result.current.handleResincronizar(); });
    expect(draftRestore.handleResincronizar).toHaveBeenCalled();
  });

  it("recargar por conflicto de sello usa la ruta de edición si hay id", () => {
    wizardState.cotizacionId = "cot-1";
    const { result } = render();
    act(() => { result.current.recargarPorConflictoSello(); });
    expect(navigateSpy).toHaveBeenCalledWith("/cotizaciones/cot-1/editar");
  });

  it("sin id, recargar cae al listado", () => {
    const { result } = render();
    act(() => { result.current.recargarPorConflictoSello(); });
    expect(navigateSpy).toHaveBeenCalledWith("/cotizaciones");
  });
});
