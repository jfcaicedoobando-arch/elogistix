/**
 * Regresión JAVASCRIPT-REACT-6A/6B: pedir la moneda de una oportunidad sin id
 * no debe llegar a la base (antes producía 22P02 `uuid: "null"` y un aviso
 * falso de "revisa tu conexión").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { fetchMonedaOportunidad } from "../monedaOportunidad";

beforeEach(() => {
  fromMock.mockReset();
});

describe("fetchMonedaOportunidad", () => {
  it("no consulta la base cuando no hay oportunidad ligada", async () => {
    await expect(fetchMonedaOportunidad(null)).resolves.toBeNull();
    await expect(fetchMonedaOportunidad("")).resolves.toBeNull();
    await expect(fetchMonedaOportunidad(undefined)).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("lee la moneda cuando sí hay oportunidad ligada", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: async () => ({ data: { id: "op-1", moneda: "USD" }, error: null }) }),
        }),
      }),
    });
    await expect(fetchMonedaOportunidad("op-1")).resolves.toBe("USD");
    expect(fromMock).toHaveBeenCalledWith("crm_oportunidades");
  });
});
