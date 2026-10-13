import { render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { createSimpleFilteredReadMock } from "@/services/__tests__/_simpleFilteredReadMock";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof createSimpleFilteredReadMock>, dialogs: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const { supabase } = createSupabaseMock();
  supabase.from.mockImplementation(table => state.db.supabase.from(table));
  supabase.rpc.mockImplementation((fn, args) => state.db.supabase.rpc(fn, args));
  return { supabase };
});
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
vi.mock("@/features/cliente/hooks", () => ({
  useClienteDetalleController: () => {
    const query = useQuery({ queryKey: ["cliente-detalle-sintetico"], queryFn: () => fetchCliente("cliente-sintetico") });
    return { cliente: query.data, loadingCliente: query.isPending, errorCliente: query.error,
      refetchCliente: query.refetch, fetchingCliente: query.isFetching,
      contactos: [], embarquesCliente: [], cotizacionesCliente: [], financials: undefined };
  },
}));
vi.mock("react-router", () => ({ useParams: () => ({ id: "cliente-sintetico" }) }));
vi.mock("@/lib/contexts/BreadcrumbContext", () => ({ useRegisterBreadcrumbLabel: vi.fn() }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/cliente/components/detalle/ClienteDetalleDialogs", () => ({ ClienteDetalleDialogs: state.dialogs }));
vi.mock("@/features/cliente/components/detalle/ClienteDetalleHeader", () => ({
  ClienteDetalleHeader: () => <button>Editar cliente</button>,
  ClienteLoadingState: () => <p>Cargando cliente</p>,
  ClienteNotFoundState: () => <p>Cliente no encontrado</p>,
}));
vi.mock("../_sections/ClienteDetalleTabs", () => ({ ClienteDetalleTabs: () => <p>Ficha editable</p> }));
vi.mock("@/features/cliente/components/ClienteSummaryCards", () => ({ default: () => null }));
import { fetchCliente } from "../../services/crud";
import ClienteDetalle from "../ClienteDetalle";

beforeEach(() => {
  vi.clearAllMocks();
  state.dialogs.mockReturnValue(null);
  state.db = createSimpleFilteredReadMock();
  const from = state.db.supabase.from.getMockImplementation()!;
  state.db.supabase.from.mockImplementation(table => {
    const chain = from(table);
    const single = chain.single as () => Promise<{ data: unknown; error: unknown }>;
    chain.single = async () => {
      const res = await single();
      return res.data === null && !res.error ? { ...res, error: { code: "PGRST116", message: "No rows" } } : res;
    };
    return chain;
  });
});

describe("detalle editable: sólo clientes actuales", () => {
  it.each([{ rows: [] }, { rows: [{ id: "cliente-sintetico", nombre: "Cliente sintético", deleted_at: "2026-01-01" }] }])(
    "la lectura real lleva la ausencia o baja al NotFound existente: %j", async ({ rows }) => {
      state.db.source("clientes", rows);
      render(<ClienteDetalle />, { wrapper: createWrapper() });
      expect(await screen.findByText("Cliente no encontrado")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Editar cliente" })).not.toBeInTheDocument();
      expect(screen.queryByText("Ficha editable")).not.toBeInTheDocument();
      expect(state.dialogs).not.toHaveBeenCalled();
    },
  );

  it("conserva el detalle editable de un cliente vivo", async () => {
    state.db.source("clientes", [{ id: "cliente-sintetico", nombre: "Cliente sintético", deleted_at: null }]);
    render(<ClienteDetalle />, { wrapper: createWrapper() });
    expect(await screen.findByRole("button", { name: "Editar cliente" })).toBeVisible();
    expect(screen.getByText("Ficha editable")).toBeVisible();
    expect(state.dialogs).toHaveBeenCalled();
  });

  it("un fallo de consulta conserva el estado de error y nunca abre edición", async () => {
    state.db.source("clientes", null, new Error("Fallo de consulta sintético"));
    render(<ClienteDetalle />, { wrapper: createWrapper() });
    expect(await screen.findByRole("alert")).toHaveTextContent("Fallo de consulta sintético");
    expect(screen.queryByText("Cliente no encontrado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cliente" })).not.toBeInTheDocument();
    expect(state.dialogs).not.toHaveBeenCalled();
  });
});
