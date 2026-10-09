import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import { fetchProveedor, type Proveedor } from "../../services/proveedoresCrud";
import { ProveedorDetalleHeader } from "../ProveedorDetalleHeader";

const mocks = vi.hoisted(() => {
  const state = {
    role: "admin" as string | null | undefined,
    row: {} as Record<string, unknown>,
    error: null as Error | null,
    columns: [] as string[],
    aprobar: vi.fn(),
    mutate: vi.fn(),
  };
  // Respetar la proyección: un resultado completo ocultaría el campo omitido.
  const chain = {
    select: vi.fn((columns: string) => {
      state.columns = columns.split(",").map((column) => column.trim());
      return chain;
    }),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({
      data: state.error ? null : Object.fromEntries(
        state.columns.map((column) => [column, state.row[column] ?? null]),
      ),
      error: state.error,
    })),
  };
  return { state, chain, from: vi.fn(() => chain) };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ effectiveRole: mocks.state.role }),
}));
vi.mock("@/features/proveedor/hooks/useProveedoresProvisionales", () => ({
  useAprobarProveedorProvisional: (id: string) => {
    mocks.state.aprobar(id);
    return { isPending: false, mutate: mocks.state.mutate };
  },
}));
vi.mock("../ProveedorCsfUpdateButton", () => ({ ProveedorCsfUpdateButton: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.role = "admin";
  mocks.state.error = null;
  mocks.state.columns = [];
  mocks.state.row = { id: "proveedor-provisional", nombre: "Agente nuevo", estado_alta: "provisional" };
});

function renderHeader(proveedor: Proveedor, canEdit = true) {
  return render(
    <MemoryRouter>
      <ProveedorDetalleHeader
        proveedor={proveedor}
        nombreFmt={proveedor.nombre}
        rfcFmt=""
        esNacional={false}
        categoriaLabel="Agente de carga"
        volver="/compras/proveedores"
        canEdit={canEdit}
        isAdmin={mocks.state.role === "admin"}
        isDeleting={false}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
      />
    </MemoryRouter>,
  );
}

async function cargarProveedor() {
  const proveedor = await fetchProveedor("proveedor-provisional");
  expect(proveedor).not.toBeNull();
  return proveedor!;
}

describe("detalle de proveedor provisional desde su proyección real", () => {
  it("selecciona estado_alta y conserva los filtros del detalle", async () => {
    const proveedor = await cargarProveedor();
    expect(mocks.from).toHaveBeenCalledWith("proveedores");
    expect(mocks.state.columns).toContain("estado_alta");
    expect(proveedor.estado_alta).toBe("provisional");
    expect(mocks.chain.eq).toHaveBeenCalledWith("id", "proveedor-provisional");
    expect(mocks.chain.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it.each(["admin", "contador", "admin_org"])("muestra insignia y aprobación para %s", async (role) => {
    mocks.state.role = role;
    renderHeader(await cargarProveedor());
    expect(screen.getByText(/Provisional.*pendiente de Contabilidad/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar como proveedor" }));
    expect(mocks.state.aprobar).toHaveBeenCalledWith("proveedor-provisional");
    expect(mocks.state.mutate).toHaveBeenCalledTimes(1);
  });

  it.each(["admin", "contador", "admin_org"])("oculta insignia y aprobación si ya fue aprobado, para %s", async (role) => {
    mocks.state.role = role;
    mocks.state.row.estado_alta = "aprobado";
    const proveedor = await cargarProveedor();
    expect(proveedor.estado_alta).toBe("aprobado");
    renderHeader(proveedor);
    expect(screen.queryByText(/Provisional.*pendiente de Contabilidad/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar como proveedor" })).not.toBeInTheDocument();
    expect(mocks.state.aprobar).not.toHaveBeenCalled();
  });

  const sinPermiso = [
    ...Constants.public.Enums.app_role.filter(
      (role) => role !== "admin" && role !== "contador" && role !== "admin_org",
    ),
    null,
    undefined,
  ];
  it.each(sinPermiso)("mantiene la insignia sin conceder aprobación al rol %s", async (role) => {
    mocks.state.role = role;
    renderHeader(await cargarProveedor());
    expect(screen.getByText(/Provisional.*pendiente de Contabilidad/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar como proveedor" })).not.toBeInTheDocument();
    expect(mocks.state.aprobar).not.toHaveBeenCalled();
  });

  it.each(["admin", "contador", "admin_org"])("conserva el bloqueo de acciones con canEdit=false para %s", async (role) => {
    mocks.state.role = role;
    renderHeader(await cargarProveedor(), false);
    expect(screen.getByText(/Provisional.*pendiente de Contabilidad/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar como proveedor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("propaga errores de consulta en lugar de fabricar un proveedor aprobado", async () => {
    const error = new Error("No se pudo cargar el proveedor");
    mocks.state.error = error;
    await expect(fetchProveedor("proveedor-provisional")).rejects.toBe(error);
  });
});
