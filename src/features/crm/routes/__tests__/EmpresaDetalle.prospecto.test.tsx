import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRole } from "@/types/appRole";
import type { EmpresaDetalleRow } from "@/features/crm/services/objetosCrm";

const state = vi.hoisted(() => ({
  data: {} as EmpresaDetalleRow, role: "vendedor" as AppRole, orgRole: "vendedor" as AppRole | null,
  memberRole: "vendedor" as AppRole | null,
  activeOrg: "org", membershipOrg: "org", active: true, loading: false, pending: false,
  mutate: vi.fn(), fetch: vi.fn(), membershipFetch: vi.fn(),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "kam" },
  role: state.role, orgRole: state.orgRole, effectiveRole: state.orgRole ?? state.role,
  organizationId: state.membershipOrg, loading: state.loading }) }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({
  organizationId: state.activeOrg, organization: { activo: state.active }, loading: false,
}) }));
vi.mock("@/features/crm/hooks/useObjetosCrm", () => ({
  useEmpresaCrm: () => ({ data: state.data, isLoading: false, isError: false }),
  usePasarAProspecto: () => ({ mutate: state.mutate, isPending: state.pending }),
}));
vi.mock("@/features/crm/services/vinculosProspectoCrm", () => ({
  fetchVinculosProspecto: state.fetch, fetchMembresiaProspecto: state.membershipFetch,
}));
vi.mock("@/hooks/shared", () => ({ useDocumentTitle: vi.fn(), usePermissions: () => ({ canEditCrm: false }) }));
vi.mock("@/features/crm/components/objetos/PropiedadesCard", () => ({ PropiedadesCard: () => null }));
vi.mock("@/features/crm/components/objetos/VinculosCard", () => ({ VinculosCard: () => null }));
vi.mock("@/features/crm/components/scoring/DesglosePuntajeCard", () => ({ DesglosePuntajeCard: () => null }));
vi.mock("@/features/crm/components/objetos/EliminarEmpresaBoton", () => ({ EliminarEmpresaBoton: () => <button>Eliminar</button> }));
import EmpresaDetalle from "../EmpresaDetalle";

beforeEach(() => {
  state.data = { id: "empresa", nombre: "Empresa KAM", cliente_id: null, estado_crm: "Lead",
    created_at: "2026-10-16", created_by: "kam", organization_id: "org", lead_origen_id: null, deleted_at: null };
  state.role = "vendedor"; state.orgRole = "vendedor"; state.memberRole = "vendedor"; state.activeOrg = "org";
  state.membershipOrg = "org"; state.active = true; state.loading = false; state.pending = false;
  state.fetch.mockReset().mockResolvedValue({ lead: null, oportunidades: [] });
  state.membershipFetch.mockReset().mockImplementation(async () => state.memberRole
    ? { role: state.memberRole, organization_id: state.activeOrg, organizations: { activo: state.active } } : null);
});

function mostrar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><EmpresaDetalle /></MemoryRouter></QueryClientProvider>);
}
const boton = () => screen.getByRole("button", { name: "Pasar a prospecto" });

describe("EmpresaDetalle: capacidad específica de pasar a prospecto", () => {
  it("KAM propio verifica vínculos y convierte aunque canEditCrm sea falso", async () => {
    mostrar();
    await waitFor(() => expect(boton()).toBeEnabled());
    expect(state.fetch).toHaveBeenCalledExactlyOnceWith("empresa", null);
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    fireEvent.click(boton());
    expect(state.mutate).toHaveBeenCalledExactlyOnceWith("empresa");
  });
  it("no escribe al hacer clic en el botón deshabilitado de una empresa ajena", async () => {
    state.data.created_by = "otro";
    mostrar();
    await screen.findByRole("button", { name: "Pasar a prospecto" });
    expect(boton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("creadas por ti");
    fireEvent.click(boton());
    expect(state.mutate).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it.each<AppRole | null>([null, "viewer", "gerente_comercial", "customer_service"])(
    "el rol global vendedor no sustituye una membresía efectiva %s", async (orgRole) => {
      state.memberRole = orgRole;
      mostrar();
      await waitFor(() => expect(state.membershipFetch).toHaveBeenCalledOnce());
      expect(screen.queryByRole("button", { name: "Pasar a prospecto" })).not.toBeInTheDocument();
      expect(state.fetch).not.toHaveBeenCalled();
      expect(state.mutate).not.toHaveBeenCalled();
    });
  it("consulta la membresía activa aunque orgRole cacheado provenga de otra organización", async () => {
    state.orgRole = "gerente_comercial";
    mostrar();
    await waitFor(() => expect(boton()).toBeEnabled());
    expect(state.membershipFetch).toHaveBeenCalledExactlyOnceWith("kam", "org");
  });
  it("preserva contador por la ruta writer sin exigirle propiedad comercial", () => {
    state.role = "contador"; state.orgRole = "contador"; state.data.created_by = "otro";
    mostrar();
    expect(boton()).toBeEnabled();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it.each(["empresa ajena al tenant", "organización inactiva"])("no habilita %s", async (caso) => {
    if (caso === "empresa ajena al tenant") state.data.organization_id = "otra-org";
    else state.active = false;
    mostrar();
    await screen.findByRole("button", { name: "Pasar a prospecto" });
    expect(boton()).toBeDisabled();
    fireEvent.click(boton());
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("deniega lead ajeno sin lanzar la mutación", async () => {
    state.data.lead_origen_id = "lead";
    state.fetch.mockResolvedValue({ lead: { id: "lead", organization_id: "org", vendedor_id: "otro",
      deleted_at: null, estado: "Nuevo", cliente_convertido_id: null }, oportunidades: [] });
    mostrar();
    await screen.findByText(/deben estar vigentes, ser tuyos/);
    expect(boton()).toBeDisabled();
    fireEvent.click(boton());
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("un fallo de lectura no habilita y permite reintentar la verificación", async () => {
    state.fetch.mockRejectedValueOnce(new Error("falló lectura"));
    mostrar();
    await screen.findByText("No se pudo verificar el permiso para pasar a prospecto.");
    expect(boton()).toBeDisabled();
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar verificación" }));
    await waitFor(() => expect(boton()).toBeEnabled());
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("durante la consulta no permite escribir", async () => {
    state.fetch.mockReturnValue(new Promise(() => {}));
    mostrar();
    await screen.findByText("Verificando permiso…");
    expect(boton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Verificando permiso");
    fireEvent.click(boton());
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("durante una mutación pendiente bloquea otro clic", async () => {
    state.pending = true;
    mostrar();
    await waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
    expect(boton()).toBeDisabled();
    fireEvent.click(boton());
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
