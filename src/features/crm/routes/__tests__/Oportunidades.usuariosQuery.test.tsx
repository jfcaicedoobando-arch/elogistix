import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Oportunidades from "../Oportunidades";

const mocks = vi.hoisted(() => ({
  admin: false,
  usuarios: vi.fn(),
  oportunidades: {
    data: { data: [] as Array<{ id: string }>, count: 0 },
    isLoading: false,
    isPlaceholderData: false,
    isError: false,
    refetch: vi.fn(),
  },
}));
vi.mock("@/hooks/shared", () => ({ useDebounce: (v: string) => v, useDocumentTitle: vi.fn(), usePermissions: () => ({ isAdmin: mocks.admin, canCrearOportunidad: true, canGestionarOportunidad: () => true }) }));
vi.mock("@/features/admin/hooks/usuario", () => ({ useUsuarios: mocks.usuarios }));
vi.mock("@/features/catalogos/hooks", () => ({ useExchangeRates: () => ({ data: undefined }) }));
vi.mock("@/features/crm/hooks", () => ({ useEtapasPipeline: () => ({ data: [] }), useOportunidades: () => mocks.oportunidades }));
vi.mock("@/features/crm/hooks/useOportunidadesFiltrado", () => ({ useVendedoresDisponibles: () => [] }));
vi.mock("@/features/crm/hooks/useMoverOportunidadEtapa", () => ({ useMoverOportunidadEtapa: () => ({}) }));
vi.mock("@/features/crm/hooks/useProximasActividades", () => ({ useProximasActividades: () => ({ data: new Map() }) }));
vi.mock("../useOportunidadesFiltrosServidor", () => ({ useOportunidadesFiltrosServidor: () => ({}), useExportarOportunidades: () => ({ exportando: false, exportarTodo: vi.fn() }) }));
vi.mock("../OportunidadesTabsView", () => ({ default: ({ ops, isLoading }: { ops: Array<{ id: string }>; isLoading: boolean }) => <div data-testid="oportunidades-tabs-props">{JSON.stringify({ ops, isLoading })}</div> }));
vi.mock("@/features/crm/components/OportunidadesFiltersSection", () => ({ default: () => null }));
vi.mock("@/features/crm/components/OportunidadesDialogs", () => ({ default: () => null }));
vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/CrmSubheader", () => ({ CrmSubheader: ({ context }: { context: string }) => <div data-testid="crm-subheader">{context}</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = false;
  mocks.usuarios.mockReturnValue({ data: [] });
  mocks.oportunidades = {
    data: { data: [], count: 0 },
    isLoading: false,
    isPlaceholderData: false,
    isError: false,
    refetch: vi.fn(),
  };
});
describe("catálogo administrativo en la ruta de oportunidades", () => {
  it.each([false, true])("consulta habilitada sólo para admin=%s", admin => {
    mocks.admin = admin;
    render(<MemoryRouter><Oportunidades /></MemoryRouter>);
    expect(mocks.usuarios).toHaveBeenCalledWith({ enabled: admin });
  });

  it("retira de la vista los resultados anteriores mientras los filtros nuevos cargan", () => {
    mocks.oportunidades = {
      data: { data: [{ id: "oportunidad-de-filtro-anterior" }], count: 1 },
      isLoading: false,
      isPlaceholderData: true,
      isError: false,
      refetch: vi.fn(),
    };

    render(<MemoryRouter><Oportunidades /></MemoryRouter>);

    expect(screen.getByTestId("crm-subheader")).toHaveTextContent(
      "Actualizando oportunidades para los filtros seleccionados",
    );
    expect(screen.getByTestId("oportunidades-tabs-props")).toHaveTextContent(
      JSON.stringify({ ops: [], isLoading: true }),
    );
  });
});
