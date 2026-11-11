import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuditoriaCount } from "@/features/auditoria/hooks/useAuditoria";
import { auditoria } from "@/features/auditoria/queryKeys";
import { bandejas } from "@/features/bandejas/queryKeys";
import { useCxpPorPagarCount } from "@/features/cxp/hooks";

const fixture = vi.hoisted(() => ({
  rpc: vi.fn(),
  org: { organizationId: "organizacion-a", orgListo: true },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: fixture.rpc } }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => fixture.org }));

function montarConteos(enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => ({
    auditoria: useAuditoriaCount({ enabled }),
    pagos: useCxpPorPagarCount({ enabled }),
  }), { wrapper });
  return { ...hook, client };
}

describe("contadores del menú lateral", () => {
  beforeEach(() => {
    fixture.rpc.mockReset().mockImplementation(async (name: string) => ({
      data: name === "auditoria_pendientes_count" ? 8 : 3,
      error: null,
    }));
    fixture.org = { organizationId: "organizacion-a", orgListo: true };
  });

  it("consulta sólo los totales y se refresca con las invalidaciones existentes", async () => {
    const { result, client } = montarConteos();
    await waitFor(() => expect([result.current.auditoria.data, result.current.pagos.data]).toEqual([8, 3]));
    expect(fixture.rpc.mock.calls.map(([rpc]) => rpc).sort()).toEqual(["auditoria_pendientes_count", "cxp_por_pagar_count"]);

    await act(async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: auditoria.revisiones }),
        client.invalidateQueries({ queryKey: bandejas.all }),
      ]);
    });
    expect(fixture.rpc.mock.calls.map(([rpc]) => rpc).sort()).toEqual([
      "auditoria_pendientes_count", "auditoria_pendientes_count", "cxp_por_pagar_count", "cxp_por_pagar_count",
    ]);
  });

  it("espera la organización activa y aísla los conteos al cambiarla", async () => {
    fixture.org.orgListo = false;
    const { rerender, result } = montarConteos();
    expect(fixture.rpc).not.toHaveBeenCalled();
    fixture.org = { organizationId: "organizacion-b", orgListo: true };
    rerender();
    await waitFor(() => expect(result.current.pagos.data).toBe(3));
    fixture.org = { organizationId: "organizacion-a", orgListo: true };
    rerender();
    await waitFor(() => expect(fixture.rpc).toHaveBeenCalledTimes(4));
  });

  it("omite ambas consultas cuando el rol no puede verlas", () => {
    montarConteos(false);
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
});
