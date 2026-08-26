/**
 * v13.756.0 — Guard: las lecturas de cotizaciones del CRM y del contador de
 * re-aprobación deben excluir las cotizaciones eliminadas (soft-delete).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCotizacionesSinRespuesta } from "../cotizacionesSinRespuesta";
import { fetchOportunidadCotizaciones } from "../oportunidadCotizaciones";
import {
  contarCotizacionesPendientesReaprobacion,
  contarMisCotizacionesPendientesReaprobacion,
} from "@/features/cotizacion/services/pendientesReaprobacion";

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
});

describe("cotizaciones · filtro de soft-delete en lecturas", () => {
  it.each([
    ["fetchCotizacionesSinRespuesta", () => fetchCotizacionesSinRespuesta()],
    ["fetchOportunidadCotizaciones", () => fetchOportunidadCotizaciones("op1")],
    ["contarCotizacionesPendientesReaprobacion", () => contarCotizacionesPendientesReaprobacion()],
    [
      "contarMisCotizacionesPendientesReaprobacion",
      () => contarMisCotizacionesPendientesReaprobacion("a@b.mx"),
    ],
  ])("%s aplica deleted_at is null", async (_nombre, ejecutar) => {
    mock.setTableResult("cotizaciones", { data: [], error: null });
    await ejecutar();
    const call = mock.tableCalls.find((c) => c.table === "cotizaciones");
    const isIdx = call?.ops.indexOf("is") ?? -1;
    expect(isIdx).toBeGreaterThanOrEqual(0);
    expect(call?.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });
});
