import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OportunidadFormFields from "../OportunidadFormFields";
import { useOrigenClienteForzado } from "@/features/crm/hooks/useOrigenClienteForzado";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import type { OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";
import type { OrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";

const fetchOrigen = vi.fn<(id: string) => Promise<OrigenEmpresa>>();
vi.mock("@/features/crm/services/origenEmpresaCrm", () => ({ fetchOrigenEmpresa: (id: string) => fetchOrigen(id) }));
vi.mock("@/features/crm/hooks/useNombreProspecto", () => ({ useNombreProspecto: () => ({ data: undefined }) }));
vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => null }));
vi.mock("../OportunidadMontosFields", () => ({ default: () => null }));
vi.mock("../OportunidadRutaFields", () => ({ default: () => null }));
vi.mock("../OportunidadMetasFields", () => ({ default: () => null }));
vi.mock("../OportunidadEmpresaField", () => ({
  OportunidadEmpresaField: ({ onChange }: { onChange: (e: { id: string; nombre: string }) => void }) => <>
    {["A", "B"].map(id => <button key={id} onClick={() => onChange({ id, nombre: id })}>{id}</button>)}
  </>,
}));
vi.mock("../SelectorOrigenOportunidad", () => ({
  default: ({ readOnly, onProspecto }: { readOnly: boolean; onProspecto: (p: { id: string; empresa: string; vendedorId: null; vendedorEmail: null }) => void }) =>
    <button disabled={readOnly} onClick={() => onProspecto({ id: "manual", empresa: "Manual", vendedorId: null, vendedorEmail: null })}>Elegir manual</button>,
}));
function Harness() {
  const [form, setForm] = useState<OportunidadFormState>({ ...EMPTY_OPORTUNIDAD, empresa_id: "A", empresa_nombre: "A", etapa_id: "e",
    lead_id: "anterior", lead_nombre: "Nombre anterior", cliente_id: "cliente-anterior", cliente_nombre: "Cliente anterior" });
  const origenEmpresa = useOrigenClienteForzado(form, true, setForm);
  return <><OportunidadFormFields form={form} setForm={setForm} set={vi.fn()} etapas={[]} clientes={[]}
    isEdit={false} origenEmpresa={origenEmpresa} autoActividad={false} setAutoActividad={vi.fn()} />
    <output data-testid="form">{JSON.stringify(form)}</output></>;
}
const estado = () => JSON.parse(screen.getByTestId("form").textContent!);
describe("cambio de empresa en el formulario real", () => {
  beforeEach(() => fetchOrigen.mockReset());
  it("misma empresa conserva manual; otra limpia ambos IDs y nombres hasta resolver", async () => {
    let resolver!: (v: OrigenEmpresa) => void;
    const pendiente = new Promise<OrigenEmpresa>(resolve => { resolver = resolve; });
    fetchOrigen.mockImplementation(id => id === "A" ? Promise.resolve({ ok: false, motivo: "Sin origen automático" }) : pendiente);
    render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Elegir manual" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Elegir manual" }));
    const seleccionado = estado();
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(estado()).toEqual(seleccionado);
    expect(fetchOrigen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(estado()).toMatchObject({ empresa_id: "B", lead_id: null, lead_nombre: "", cliente_id: null, cliente_nombre: "" });
    expect(screen.getByRole("button", { name: "Elegir manual" })).toBeDisabled();
    expect(screen.getByText(/Consultando el origen/)).toHaveAttribute("role", "status");
    await act(async () => resolver({ ok: true, origen: { tipo: "cliente", id: "cliente-B", nombre: "Cliente B" } }));
    await waitFor(() => expect(estado().cliente_id).toBe("cliente-B"));
    expect(estado()).toMatchObject({ cliente_nombre: "Cliente B", lead_id: null, lead_nombre: "" });
    expect(screen.getByRole("button", { name: "Elegir manual" })).toBeDisabled();
  });
});
