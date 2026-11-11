import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTopTarifas } from "../useTopTarifas";

const mocks = vi.hoisted(() => ({
  catalogo: vi.fn(),
  buscar: vi.fn(),
  reintentarCatalogo: vi.fn(),
}));

vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: mocks.catalogo }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: "org" }) }));
vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchTopTarifas: mocks.buscar }));

const CANONICO = "00000000-0000-0000-0000-000000000001";
const ALIAS = "00000000-0000-0000-0000-000000000002";
const DESCONOCIDO = "00000000-0000-0000-0000-000000000003";
const origen = "00000000-0000-0000-0000-000000000004";
const destino = "00000000-0000-0000-0000-000000000005";
const dry = { id: CANONICO, code: "20DRY", name: "20 Dry", created_at: "2026-01-01", idsEquivalentes: [CANONICO] };
const gp = { id: ALIAS, code: "20GP", name: "20 GP", created_at: "2026-02-01", idsEquivalentes: [ALIAS] };

function consultar(tipoContenedorId = CANONICO) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return renderHook(() => useTopTarifas({
    puertoOrigenId: origen, puertoDestinoId: destino, tipoContenedorId,
  }), { wrapper });
}

describe("búsqueda Top de tarifas y catálogo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.buscar.mockResolvedValue([]);
  });

  it("espera el catálogo y cambia de clave cuando se amplían los aliases del mismo canónico", async () => {
    mocks.catalogo.mockReturnValue({ isPending: true });
    const { result, rerender } = consultar();
    expect(result.current.isFetching).toBe(true);
    expect(result.current.tipoContenedorIds).toEqual([]);
    expect(mocks.buscar).not.toHaveBeenCalled();

    mocks.catalogo.mockReturnValue({ isSuccess: true, data: [dry] });
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.buscar).toHaveBeenLastCalledWith(expect.objectContaining({
      tipoContenedorId: CANONICO, tipoContenedorIds: [CANONICO],
    }));

    mocks.catalogo.mockReturnValue({ isSuccess: true, data: [gp, dry] });
    rerender();
    await waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2));
    expect(mocks.buscar).toHaveBeenLastCalledWith(expect.objectContaining({
      tipoContenedorId: CANONICO, tipoContenedorIds: [CANONICO, ALIAS],
    }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    mocks.catalogo.mockReturnValue({ isSuccess: true, data: [dry, gp] });
    rerender();
    expect(result.current.isSuccess).toBe(true);
    expect(mocks.buscar).toHaveBeenCalledTimes(2);
  });

  it("reintenta el catálogo ante un error y consulta un UUID desconocido sólo tras resolverlo", async () => {
    const error = new Error("Catálogo no disponible");
    mocks.catalogo.mockReturnValue({ isError: true, error, refetch: mocks.reintentarCatalogo });
    const { result, rerender } = consultar(DESCONOCIDO);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(error);
    expect(mocks.buscar).not.toHaveBeenCalled();
    void result.current.refetch();
    expect(mocks.reintentarCatalogo).toHaveBeenCalledOnce();

    mocks.catalogo.mockReturnValue({ isSuccess: true, data: [] });
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.buscar).toHaveBeenCalledWith(expect.objectContaining({
      tipoContenedorId: DESCONOCIDO, tipoContenedorIds: [DESCONOCIDO],
    }));
  });
});
