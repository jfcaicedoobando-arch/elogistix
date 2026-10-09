import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickCreateOportunidad } from "../useQuickCreateOportunidad";

const mutateAsync = vi.fn(async () => ({ id: "op-1" }));
const fetchOrigenMock = vi.fn();

const ETAPAS = [
  { id: "e-ab", tipo: "abierta", probabilidad_default: 20 },
  { id: "e-neg", tipo: "abierta", probabilidad_default: 60 },
];
const EMPRESA = { id: "empresa-1", nombre: "Acme" };
const ORIGEN = {
  tipo: "prospecto" as const,
  id: "lead-1",
  nombre: "Acme",
  vendedorId: "u-dueno",
  vendedorEmail: "dueno@example.test",
};

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-captura", email: "captura@example.test" },
  }),
}));
vi.mock("@/features/crm/hooks", () => ({
  useCrearOportunidad: () => ({ mutateAsync, isPending: false }),
  useEtapasPipeline: () => ({ data: ETAPAS }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
vi.mock("@/features/crm/services/origenEmpresaCrm", () => ({
  fetchOrigenEmpresa: (...args: unknown[]) => fetchOrigenMock(...args),
}));

function montar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return renderHook(
    () => useQuickCreateOportunidad({
      open: true,
      onOpenChange: vi.fn(),
      onCreated: vi.fn(),
    }),
    {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    },
  );
}

describe("useQuickCreateOportunidad · borrador hacia Más campos", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    fetchOrigenMock.mockReset();
    fetchOrigenMock.mockResolvedValue({ ok: true, origen: ORIGEN });
  });

  it.each([
    { texto: "", listo: false },
    { texto: "0", listo: false },
    { texto: "1500", listo: true },
    { texto: "1500.25", listo: true },
    { texto: "0.01", listo: true },
  ])("transporta '$texto' sin cambiar las reglas de alta rápida", async ({
    texto,
    listo,
  }) => {
    const { result } = montar();

    act(() => {
      result.current.setNombre("  Importación China Q1  ");
      result.current.setEmpresa(EMPRESA);
      result.current.setEtapaId("e-neg");
      result.current.setValorEstimado(texto);
    });

    await waitFor(() => {
      expect(result.current.construirBorrador().origen).toEqual(ORIGEN);
    });

    expect(result.current.listo).toBe(listo);
    expect(result.current.construirBorrador()).toEqual({
      nombre: "Importación China Q1",
      empresa: EMPRESA,
      origen: ORIGEN,
      etapaId: "e-neg",
      valorEstimado: texto,
    });

    if (!listo) {
      await act(async () => { await result.current.submit(); });
      expect(mutateAsync).not.toHaveBeenCalled();
    }
  });
});
