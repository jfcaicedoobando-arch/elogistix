/**
 * Cubre el helper `invalidateHuecoFacturacion` (Fase D).
 */
import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateHuecoFacturacion } from "../invalidateHuecoFacturacion";
import { HUECO_QUERY_KEY_PREFIX } from "@/features/facturacion/services/huecoFacturacion/constants";

describe("invalidateHuecoFacturacion", () => {
  it("invalida usando el prefijo compartido del hueco", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    invalidateHuecoFacturacion(qc);

    expect(spy).toHaveBeenCalledWith({ queryKey: HUECO_QUERY_KEY_PREFIX });
    qc.clear();
  });

  it("HUECO_QUERY_KEY_PREFIX es estable ('facturacion' → 'hueco')", () => {
    expect(HUECO_QUERY_KEY_PREFIX).toEqual(["facturacion", "hueco"]);
  });
});
