/**
 * Alta express de oportunidad: etapa elegida (sólo abiertas), valor estimado
 * obligatorio y origen deducido de la empresa asociada.
 */
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QuickCreateOportunidadDialog from "@/features/crm/components/quickCreate/QuickCreateOportunidadDialog";
import { crm } from "@/features/crm/queryKeys";
import type { OrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({ id: "op-1" }));
const notifyError = vi.fn();
const origenMock = vi.fn();

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-actual", email: "actual@x.com" } }),
}));
const etapasMock: { id: string; nombre: string; orden: number; probabilidad_default: number; tipo: string }[] = [];
vi.mock("@/features/crm/hooks", () => ({
  useCrearOportunidad: () => ({ mutateAsync, isPending: false }),
  useEtapasPipeline: () => ({ data: etapasMock }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));
vi.mock("@/features/crm/services/origenEmpresaCrm", () => ({
  fetchOrigenEmpresa: (...a: unknown[]) => origenMock(...a),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select data-testid="etapa" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));
vi.mock("@/features/crm/components/nuevaOportunidad/OportunidadEmpresaField", () => ({
  OportunidadEmpresaField: ({ onChange }: { onChange: (e: { id: string; nombre: string }) => void }) => (
    <><button type="button" onClick={() => onChange({ id: "empresa-1", nombre: "Acme" })}>elegir-empresa</button>
    <button type="button" onClick={() => onChange({ id: "empresa-2", nombre: "Empresa B" })}>elegir-B</button></>
  ),
}));

function montar(onMore = vi.fn(), qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={qc}>
      <QuickCreateOportunidadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={onMore} />
    </QueryClientProvider>,
  );
}

function diferido() {
  let resolve!: (value: OrigenEmpresa) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<OrigenEmpresa>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function completar() {
  fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Operación" } });
  fireEvent.click(screen.getByRole("button", { name: "elegir-empresa" }));
  fireEvent.change(screen.getByLabelText(/Valor estimado/i), { target: { value: "10" } });
}
const enviarFormulario = () => fireEvent.submit(screen.getByLabelText(/Nombre/i).closest("form")!);

describe("QuickCreateOportunidadDialog", () => {
  beforeEach(() => {
    mutateAsync.mockClear(); notifyError.mockClear(); origenMock.mockReset();
    etapasMock.length = 0;
    etapasMock.push(
      { id: "e-gan", nombre: "Ganada", orden: 1, probabilidad_default: 100, tipo: "ganada" },
      { id: "e-ab", nombre: "Prospecto", orden: 2, probabilidad_default: 20, tipo: "abierta" },
      { id: "e-neg", nombre: "Negociación", orden: 3, probabilidad_default: 60, tipo: "abierta" },
    );
  });

  it("crea en la etapa elegida con valor estimado y origen del prospecto de la empresa", async () => {
    origenMock.mockResolvedValue({ ok: true, origen: { tipo: "prospecto", id: "lead-1", nombre: "ACME", vendedorId: "u-dueno", vendedorEmail: "dueno@x.com" } });
    montar();
    expect(screen.queryByRole("option", { name: "Ganada" })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Op nueva" } });
    fireEvent.click(screen.getByRole("button", { name: "elegir-empresa" }));
    fireEvent.change(screen.getByTestId("etapa"), { target: { value: "e-neg" } });
    expect(screen.getByText(/Falta: valor estimado/)).toHaveAttribute("role", "status");
    fireEvent.change(screen.getByLabelText(/Valor estimado/i), { target: { value: "1500" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      empresa_id: "empresa-1", lead_id: "lead-1", cliente_id: null, etapa_id: "e-neg",
      probabilidad: 60, monto_meta: 1500, vendedor_id: "u-dueno",
    });
  });

  it("bloquea si la empresa no tiene prospecto ni cliente", async () => {
    origenMock.mockResolvedValue({ ok: false, motivo: "Esta empresa aún no es prospecto ni cliente." });
    montar();
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Op" } });
    fireEvent.click(screen.getByRole("button", { name: "elegir-empresa" }));
    fireEvent.change(screen.getByLabelText(/Valor estimado/i), { target: { value: "10" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("no es prospecto");
    expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
  });

  it("sin etapas abiertas no permite crear", () => {
    etapasMock.length = 0;
    montar();
    expect(screen.getByText("Configura al menos una etapa abierta en el pipeline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
  });

  it("A→B y late A: Enter/submit pendiente bloqueado, Más campos lleva origen null", async () => {
    const a = diferido(), b = diferido(), onMore = vi.fn();
    origenMock.mockImplementation((id: string) => id === "empresa-1" ? a.promise : b.promise);
    montar(onMore); completar();
    enviarFormulario();
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "elegir-B" }));
    fireEvent.click(screen.getByRole("button", { name: /Más campos/ }));
    expect(onMore).toHaveBeenLastCalledWith(expect.objectContaining({ empresa: { id: "empresa-2", nombre: "Empresa B" }, origen: null }));
    await act(async () => b.resolve({ ok: true, origen: { tipo: "cliente", id: "cliente-B", nombre: "Cliente B" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled());
    await act(async () => a.resolve({ ok: true, origen: { tipo: "cliente", id: "cliente-A", nombre: "Cliente A" } }));
    enviarFormulario();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: "empresa-2", cliente_id: "cliente-B", lead_id: null,
    })));
  });

  it("error accesible bloquea Enter; reintento habilita sólo al resolver", async () => {
    const next = diferido();
    origenMock.mockRejectedValueOnce(new Error("Error de red")).mockReturnValue(next.promise);
    montar(); completar();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar");
    enviarFormulario();
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta de origen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Consultando"));
    enviarFormulario();
    expect(mutateAsync).not.toHaveBeenCalled();
    await act(async () => next.resolve({ ok: true, origen: { tipo: "cliente", id: "cliente-A", nombre: "Cliente" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled());
    enviarFormulario();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });

  it("caché con refetch pendiente/fallido no envía ni transporta un origen viejo", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(crm.origenEmpresa("empresa-1"), { ok: true, origen: { tipo: "cliente", id: "viejo", nombre: "Viejo" } });
    const next = diferido(), onMore = vi.fn();
    origenMock.mockReturnValue(next.promise);
    montar(onMore, qc); completar();
    enviarFormulario();
    fireEvent.click(screen.getByRole("button", { name: /Más campos/ }));
    expect(onMore).toHaveBeenLastCalledWith(expect.objectContaining({ origen: null }));
    expect(mutateAsync).not.toHaveBeenCalled();
    await act(async () => next.reject(new Error("Error refetch")));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar");
    enviarFormulario();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
