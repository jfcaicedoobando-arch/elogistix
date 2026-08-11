/**
 * `useAgenteTarifaRutas` es un query wrapper de `fetchAgenteRutas` (sin
 * argumentos: el scoping por agente/organización lo resuelve la RPC
 * SECURITY DEFINER en el servidor). Este test verifica:
 * - que la queryKey incluya el `organizationId` recibido (para no
 *   compartir caché entre organizaciones distintas),
 * - que sólo se dispare cuando hay `organizationId` y `open === true`,
 * - manejo de datos y de error.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useAgenteTarifaRutas } from "../useAgenteTarifaRutas";
import * as portalAgenteServices from "@/features/portal-agente/services";
import { queryKeys } from "@/lib/query";

vi.mock("@/features/portal-agente/services", () => ({
  fetchAgenteRutas: vi.fn(),
}));

describe("useAgenteTarifaRutas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no dispara la consulta si organizationId es undefined", () => {
    const { result } = renderHook(() => useAgenteTarifaRutas(undefined, true), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(portalAgenteServices.fetchAgenteRutas).not.toHaveBeenCalled();
  });

  it("no dispara la consulta si open es false, aunque haya organizationId", () => {
    const { result } = renderHook(() => useAgenteTarifaRutas("org-1", false), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(portalAgenteServices.fetchAgenteRutas).not.toHaveBeenCalled();
  });

  it("dispara fetchAgenteRutas() sin filtros del cliente cuando hay org y open=true", async () => {
    vi.mocked(portalAgenteServices.fetchAgenteRutas).mockResolvedValue([
      { id: "r1", organization_id: "org-1", activa: true },
    ]);

    const { result } = renderHook(() => useAgenteTarifaRutas("org-1", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(portalAgenteServices.fetchAgenteRutas).toHaveBeenCalledTimes(1);
    // Se llama sin argumentos: el filtrado por agente/organización lo hace
    // la RPC server-side (get_agente_rutas), no un parámetro del cliente.
    expect(portalAgenteServices.fetchAgenteRutas).toHaveBeenCalledWith();
    expect(result.current.data).toHaveLength(1);
  });

  it("usa una queryKey distinta por organizationId (aislamiento de caché entre organizaciones)", () => {
    const keyA = queryKeys.portalAgente.rutas("org-a");
    const keyB = queryKeys.portalAgente.rutas("org-b");
    expect(keyA).not.toEqual(keyB);
    expect(keyA).toContain("org-a");
  });

  it("propaga el error si fetchAgenteRutas rechaza", async () => {
    vi.mocked(portalAgenteServices.fetchAgenteRutas).mockRejectedValue(new Error("denied"));

    const { result } = renderHook(() => useAgenteTarifaRutas("org-1", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
