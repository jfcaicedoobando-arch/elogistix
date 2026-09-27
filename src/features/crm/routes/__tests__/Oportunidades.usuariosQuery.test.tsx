import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Oportunidades from "../Oportunidades";

const mocks = vi.hoisted(() => ({ admin: false, usuarios: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useDebounce: (v: string) => v, useDocumentTitle: vi.fn(), usePermissions: () => ({ isAdmin: mocks.admin, canCrearOportunidad: true, canGestionarOportunidad: () => true }) }));
vi.mock("@/features/admin/hooks/usuario", () => ({ useUsuarios: mocks.usuarios }));
vi.mock("@/features/catalogos/hooks", () => ({ useExchangeRates: () => ({ data: undefined }) }));
vi.mock("@/features/crm/hooks", () => ({ useEtapasPipeline: () => ({ data: [] }), useOportunidades: () => ({ data: { data: [], count: 0 }, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/features/crm/hooks/useOportunidadesFiltrado", () => ({ useVendedoresDisponibles: () => [] }));
vi.mock("@/features/crm/hooks/useMoverOportunidadEtapa", () => ({ useMoverOportunidadEtapa: () => ({}) }));
vi.mock("@/features/crm/hooks/useProximasActividades", () => ({ useProximasActividades: () => ({ data: new Map() }) }));
vi.mock("../useOportunidadesFiltrosServidor", () => ({ useOportunidadesFiltrosServidor: () => ({}), useExportarOportunidades: () => ({ exportando: false, exportarTodo: vi.fn() }) }));
vi.mock("../OportunidadesTabsView", () => ({ default: () => null }));
vi.mock("@/features/crm/components/OportunidadesFiltersSection", () => ({ default: () => null }));
vi.mock("@/features/crm/components/OportunidadesDialogs", () => ({ default: () => null }));
vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/CrmSubheader", () => ({ CrmSubheader: () => null }));

beforeEach(() => { vi.clearAllMocks(); mocks.admin = false; mocks.usuarios.mockReturnValue({ data: [] }); });
describe("catálogo administrativo en la ruta de oportunidades", () => {
  it.each([false, true])("consulta habilitada sólo para admin=%s", admin => {
    mocks.admin = admin;
    render(<MemoryRouter><Oportunidades /></MemoryRouter>);
    expect(mocks.usuarios).toHaveBeenCalledWith({ enabled: admin });
  });
});
