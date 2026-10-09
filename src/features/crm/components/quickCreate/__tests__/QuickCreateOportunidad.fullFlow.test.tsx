import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickCreateOportunidadDialog, { type OportunidadQuickDraft } from "../QuickCreateOportunidadDialog";
import QuickAddFullDialogs from "../QuickAddFullDialogs";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";

const mocks = vi.hoisted(() => ({
  crear: vi.fn(async (_input: Record<string, unknown>) => ({ id: "op-1" })),
  actualizar: vi.fn(),
  actividad: vi.fn(async () => ({ id: "act-1" })),
  origen: vi.fn(),
}));
const ETAPAS = [
  { id: "e-ab", nombre: "Prospecto", orden: 1, tipo: "abierta", probabilidad_default: 20 },
  { id: "e-neg", nombre: "Negociación", orden: 2, tipo: "abierta", probabilidad_default: 60 },
  { id: "e-gan", nombre: "Ganada", orden: 3, tipo: "ganada", probabilidad_default: 100 },
];
const ORIGEN = {
  tipo: "prospecto" as const, id: "lead-1", nombre: "Acme",
  vendedorId: "u-dueno", vendedorEmail: "dueno@example.test",
};

vi.mock("@/features/crm/hooks", async () => {
  const real = await vi.importActual<typeof import("@/features/crm/hooks/useOportunidadForm")>(
    "@/features/crm/hooks/useOportunidadForm",
  );
  return {
    useOportunidadForm: real.useOportunidadForm,
    useEtapasPipeline: () => ({ data: ETAPAS }),
    useCrearOportunidad: () => ({ mutateAsync: mocks.crear, isPending: false }),
    useActualizarOportunidad: () => ({ mutateAsync: mocks.actualizar, isPending: false }),
    useCrearActividad: () => ({ mutateAsync: mocks.actividad, isPending: false }),
  };
});
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-captura", email: "captura@example.test" } }),
}));
vi.mock("@/features/cliente/hooks", () => ({
  useClientesForSelect: () => ({ data: [] }),
}));
vi.mock("@/features/crm/services/origenEmpresaCrm", () => ({
  fetchOrigenEmpresa: (...args: unknown[]) => mocks.origen(...args),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(), notifySuccess: vi.fn(), notifyInfo: vi.fn(),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: {
    value: string; onValueChange: (v: string) => void; children: ReactNode;
  }) => <select data-testid="quick-etapa" value={value}
    onChange={(e) => onValueChange(e.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) =>
    <option value={value}>{children}</option>,
}));
vi.mock("@/features/crm/components/nuevaOportunidad/OportunidadEmpresaField", () => ({
  OportunidadEmpresaField: ({ onChange }: {
    onChange: (empresa: { id: string; nombre: string }) => void;
  }) => <button type="button"
    onClick={() => onChange({ id: "empresa-1", nombre: "Acme" })}>Elegir Acme</button>,
}));
vi.mock("@/features/crm/components/nuevaOportunidad/OportunidadFormFields", () => ({
  default: ({ form, autoActividad, setAutoActividad }: {
    form: OportunidadFormState;
    autoActividad: boolean;
    setAutoActividad: (v: boolean) => void;
  }) => <>
    <output data-testid="full-state">{JSON.stringify(form)}</output>
    <label>
      <input type="checkbox" checked={autoActividad}
        onChange={(e) => setAutoActividad(e.target.checked)} />
      Crear actividad automática
    </label>
  </>,
}));
vi.mock("@/features/crm/components/NuevoLeadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/NuevaActividadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/ImportarLeadsCsvDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/hooks/useVolverAgendaActividad", () => ({
  useVolverAgendaActividad: () => vi.fn(),
}));

function Recorrido() {
  const [quickOpen, setQuickOpen] = useState(true);
  const [fullOpen, setFullOpen] = useState(false);
  const [draft, setDraft] = useState<OportunidadQuickDraft | null>(null);
  return <>
    <QuickCreateOportunidadDialog open={quickOpen} onOpenChange={setQuickOpen}
      onCreated={vi.fn()} onMore={(capturado) => {
        setDraft(capturado); setQuickOpen(false); setFullOpen(true);
      }} />
    <QuickAddFullDialogs leadOpen={false} onLeadOpenChange={vi.fn()} leadDraft={null}
      opOpen={fullOpen} onOpOpenChange={setFullOpen} opDraft={draft}
      actOpen={false} onActOpenChange={vi.fn()} actDraft={null}
      importOpen={false} onImportOpenChange={vi.fn()} />
  </>;
}

function montar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(<QueryClientProvider client={qc}><MemoryRouter>
    <Recorrido />
  </MemoryRouter></QueryClientProvider>);
}

const estadoCompleto = () => JSON.parse(
  screen.getByTestId("full-state").textContent ?? "{}",
) as OportunidadFormState;

describe("alta rápida → Más campos → envío completo real", () => {
  beforeEach(() => {
    mocks.crear.mockClear(); mocks.actualizar.mockClear(); mocks.actividad.mockClear();
    mocks.origen.mockReset();
    mocks.origen.mockResolvedValue({ ok: true, origen: ORIGEN });
  });

  it.each([
    { texto: "1500", monto: 1500, persistido: 1500, quickListo: true },
    { texto: "1500.25", monto: 1500.25, persistido: 1500.25, quickListo: true },
    { texto: "0.01", monto: 0.01, persistido: 0.01, quickListo: true },
    { texto: "", monto: 0, persistido: null, quickListo: false },
    { texto: "0", monto: 0, persistido: null, quickListo: false },
  ])("transporta y persiste '$texto' MXN con las reglas existentes", async ({
    texto, monto, persistido, quickListo,
  }) => {
    montar();
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "  Importación China Q1  " } });
    fireEvent.click(screen.getByRole("button", { name: "Elegir Acme" }));
    fireEvent.change(screen.getByTestId("quick-etapa"), { target: { value: "e-neg" } });
    fireEvent.change(screen.getByLabelText(/Valor estimado/i), {
      target: { value: quickListo ? texto : "1" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled());
    expect(mocks.origen).toHaveBeenCalledWith("empresa-1");
    if (!quickListo) {
      fireEvent.change(screen.getByLabelText(/Valor estimado/i), { target: { value: texto } });
      expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Crear" }));
      expect(mocks.crear).not.toHaveBeenCalled();
    }

    fireEvent.click(screen.getByRole("button", { name: /Más campos/ }));
    await waitFor(() => expect(estadoCompleto()).toMatchObject({
      nombre: "Importación China Q1", empresa_id: "empresa-1", empresa_nombre: "Acme",
      origen_tipo: "prospecto", lead_id: "lead-1", etapa_id: "e-neg", probabilidad: 60,
      vendedor_id: "u-dueno", vendedor_email: "dueno@example.test", moneda: "MXN", monto_meta: monto,
    }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Crear actividad automática" }));
    expect(screen.getByRole("button", { name: "Crear oportunidad" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Crear oportunidad" }));

    await waitFor(() => expect(mocks.crear).toHaveBeenCalledTimes(1));
    expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: "Importación China Q1", empresa_id: "empresa-1", lead_id: "lead-1", cliente_id: null,
      etapa_id: "e-neg", probabilidad: 60, vendedor_id: "u-dueno",
      vendedor_email: "dueno@example.test", moneda: "MXN", monto_meta: persistido,
    }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Crear oportunidad" })).toBeNull());
    expect(mocks.actividad).not.toHaveBeenCalled();
    expect(mocks.actualizar).not.toHaveBeenCalled();
  });
});
