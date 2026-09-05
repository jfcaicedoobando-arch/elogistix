/**
 * Regresiones de calendario MX (frontera de mes y husos UTC vs CDMX) para:
 * - `fechaSeguimientoContacto` (auto-registro de contacto)
 * - `fetchCotizacionesSinRespuesta` (corte y contador de días)
 * - `buildVistasGuardadas` ("Cierra este mes")
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hoyMx } from "@/lib/date/mx";
import {
  DIAS_SEGUIMIENTO_CONTACTO,
  fechaSeguimientoContacto,
} from "../autoRegistroContacto";
import { buildVistasGuardadas } from "@/features/crm/domain/oportunidades/vistasGuardadas";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => mocks.query() },
}));

/** Instante donde UTC ya es el día/mes siguiente y CDMX aún no. */
const FIN_DE_MES = new Date("2026-10-01T03:30:00Z"); // 30/09/2026 21:30 CDMX

describe("fechaSeguimientoContacto · días de calendario CDMX", () => {
  it("suma DIAS_SEGUIMIENTO_CONTACTO sobre el día de negocio MX", () => {
    const iso = fechaSeguimientoContacto(FIN_DE_MES);
    expect(hoyMx(new Date(iso))).toBe("2026-10-02");
    expect(DIAS_SEGUIMIENTO_CONTACTO).toBe(2);
  });

  it("conserva la hora local MX del contacto", () => {
    const iso = fechaSeguimientoContacto(FIN_DE_MES);
    const horaMxTexto = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    expect(horaMxTexto).toBe("21:30");
  });
});

describe("fetchCotizacionesSinRespuesta · corte y días en CDMX", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIN_DE_MES);
  });
  afterEach(() => {
    vi.useRealTimers();
    mocks.query.mockReset();
  });

  it("corta contra el día MX y cuenta los días con calendario MX", async () => {
    const lte = vi.fn();
    const filas = [
      {
        id: "c1",
        folio: "COT-1",
        cliente_nombre: "ACME",
        es_prospecto: false,
        prospecto_empresa: null,
        subtotal: 100,
        moneda: "MXN",
        created_at: "2026-09-20T18:00:00Z", // 20/09 CDMX → 10 días
        oportunidad_id: null,
      },
    ];
    const chain = {
      select: () => chain,
      eq: () => chain,
      lte: (_col: string, valor: string) => { lte(valor); return chain; },
      is: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: filas, error: null }),
    };
    mocks.query.mockReturnValue(chain);

    const { fetchCotizacionesSinRespuesta } = await import("../cotizacionesSinRespuesta");
    const rows = await fetchCotizacionesSinRespuesta(5);

    expect(rows[0].dias).toBe(10);
    // El corte es 5 días antes del 30/09 CDMX = 25/09 CDMX.
    expect(hoyMx(new Date(lte.mock.calls[0][0] as string))).toBe("2026-09-25");
  });
});

describe("buildVistasGuardadas · Cierra este mes en CDMX", () => {
  it("usa el mes de negocio MX en frontera de mes", () => {
    const vistas = buildVistasGuardadas({ hoy: FIN_DE_MES });
    const cierra = vistas.find((v) => v.id === "cierra-mes")!;
    expect(cierra.filtros.cierreDesde).toBe("2026-09-01");
    expect(cierra.filtros.cierreHasta).toBe("2026-09-30");
  });

  it("mantiene el formato yyyy-MM-dd en un instante ordinario", () => {
    const vistas = buildVistasGuardadas({ hoy: new Date("2026-02-10T18:00:00Z") });
    const cierra = vistas.find((v) => v.id === "cierra-mes")!;
    expect(cierra.filtros.cierreDesde).toBe("2026-02-01");
    expect(cierra.filtros.cierreHasta).toBe("2026-02-28");
  });
});
