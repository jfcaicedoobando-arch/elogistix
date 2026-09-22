/**
 * Etapa 3 — identidad explícita de puertos en el formulario de cotización.
 *
 * Cubre: aplicar tarifa persiste los IDs exactos, la resolución legacy nunca
 * usa "primer match" entre homónimos, y cambiar la ruta desvincula la tarifa
 * incompatible sin tocar los costos capturados.
 */
import { describe, it, expect, vi } from "vitest";
import type { UseFormSetValue, UseFormTrigger } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { aplicarTarifaAlForm } from "../aplicarTarifa";
import { resolverPuertoId } from "../resolverCatalogos";
import { aplicarSeleccionPuerto } from "../rutaPuertoHandlers";
import type { Ctx } from "../overrideHelpers";

const ROTTERDAM = "11111111-1111-1111-1111-111111111111";
const VERACRUZ = "22222222-2222-2222-2222-222222222222";

const PUERTOS = [
  { id: ROTTERDAM, name: "Rotterdam", country: "Países Bajos", code: "NLRTM" },
  { id: VERACRUZ, name: "Veracruz", country: "México", code: "MXVER" },
  // Homónimos reales: mismo nombre, países y UN/LOCODE distintos.
  { id: "aaa", name: "Santos", country: "Brasil", code: "BRSSZ" },
  { id: "bbb", name: "Santos", country: "España", code: "ESSNT" },
];

function tarifaRotterdamVeracruz(): TopTarifaRow {
  return {
    id: "tarifa-1",
    puerto_origen_id: ROTTERDAM,
    puerto_destino_id: VERACRUZ,
    puerto_origen_nombre: "Rotterdam",
    puerto_destino_nombre: "Veracruz",
  } as unknown as TopTarifaRow;
}

describe("Etapa 3 · aplicarTarifaAlForm", () => {
  it("persiste los IDs exactos de puerto de la tarifa", () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<CotizacionFormValues>;
    const trigger = vi.fn() as unknown as UseFormTrigger<CotizacionFormValues>;

    aplicarTarifaAlForm(setValue, trigger, tarifaRotterdamVeracruz());

    const calls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toEqual(expect.arrayContaining([
      ["puertoOrigenId", ROTTERDAM, expect.anything()],
      ["puertoDestinoId", VERACRUZ, expect.anything()],
    ]));
  });

  it("deja los IDs en null si la tarifa legacy no los trae", () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<CotizacionFormValues>;
    const trigger = vi.fn() as unknown as UseFormTrigger<CotizacionFormValues>;
    const row = { id: "t", puerto_origen_nombre: "Shanghai", puerto_destino_nombre: "Manzanillo" } as unknown as TopTarifaRow;

    aplicarTarifaAlForm(setValue, trigger, row);

    const calls = (setValue as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toEqual(expect.arrayContaining([
      ["puertoOrigenId", null, expect.anything()],
      ["puertoDestinoId", null, expect.anything()],
    ]));
  });
});

describe("Etapa 3 · resolverPuertoId (compatibilidad legacy)", () => {
  it("acepta el ID directo", () => {
    expect(resolverPuertoId(ROTTERDAM, PUERTOS)).toBe(ROTTERDAM);
  });

  it("resuelve por UN/LOCODE exacto", () => {
    expect(resolverPuertoId("NLRTM", PUERTOS)).toBe(ROTTERDAM);
    expect(resolverPuertoId("MXVER", PUERTOS)).toBe(VERACRUZ);
  });

  it("resuelve por etiqueta completa", () => {
    expect(resolverPuertoId("Rotterdam, Países Bajos (NLRTM)", PUERTOS)).toBe(ROTTERDAM);
    expect(resolverPuertoId("Santos, Brasil (BRSSZ)", PUERTOS)).toBe("aaa");
  });

  it("NO adivina entre homónimos: devuelve undefined", () => {
    expect(resolverPuertoId("Santos", PUERTOS)).toBeUndefined();
  });

  it("no resuelve texto que no coincide exactamente", () => {
    expect(resolverPuertoId("Rott", PUERTOS)).toBeUndefined();
    expect(resolverPuertoId("", PUERTOS)).toBeUndefined();
  });

  it("resuelve el puerto dentro de una ruta puerta a puerta", () => {
    expect(resolverPuertoId("MXVER → Parque Industrial Apodaca", PUERTOS)).toBe(VERACRUZ);
  });
});

function ctxFalso(valores: Partial<CotizacionFormValues>) {
  const estado = { ...valores } as Record<string, unknown>;
  const setValue = vi.fn((campo: string, valor: unknown) => { estado[campo] = valor; });
  return {
    ctx: { getValues: (campo: string) => estado[campo], setValue } as unknown as Ctx,
    estado,
    setValue,
  };
}

describe("Etapa 3 · aplicarSeleccionPuerto", () => {
  it("guarda texto visible e ID exacto", () => {
    const { ctx, estado } = ctxFalso({ puertoOrigenId: null, tarifaId: null });
    const res = aplicarSeleccionPuerto(ctx, "origen", "Rotterdam, Países Bajos (NLRTM)", ROTTERDAM);
    expect(res.tarifaDesvinculada).toBe(false);
    expect(estado.origen).toBe("Rotterdam, Países Bajos (NLRTM)");
    expect(estado.puertoOrigenId).toBe(ROTTERDAM);
  });

  it("texto libre deja el ID en null", () => {
    const { ctx, estado } = ctxFalso({ puertoOrigenId: ROTTERDAM, tarifaId: null });
    aplicarSeleccionPuerto(ctx, "origen", "Puerto nuevo", null);
    expect(estado.puertoOrigenId).toBeNull();
  });

  it("cambiar la ruta desvincula la tarifa y lo heredado, sin tocar costos", () => {
    const { ctx, estado } = ctxFalso({
      puertoOrigenId: ROTTERDAM,
      tarifaId: "tarifa-1",
      agenteId: "ag-1",
      navieraId: "nav-1",
    });
    const res = aplicarSeleccionPuerto(ctx, "origen", "Veracruz, México (MXVER)", VERACRUZ);
    expect(res.tarifaDesvinculada).toBe(true);
    expect(estado.tarifaId).toBeNull();
    expect(estado.agenteId).toBeNull();
    expect(estado.navieraId).toBeNull();
    expect(estado.tarifaOverride).toEqual({});
    // Los costos/conceptos no se tocan: no hay escritura sobre ellos.
    expect(estado).not.toHaveProperty("conceptos");
  });

  it("re-elegir el MISMO puerto no desvincula la tarifa", () => {
    const { ctx, estado } = ctxFalso({ puertoOrigenId: ROTTERDAM, tarifaId: "tarifa-1" });
    const res = aplicarSeleccionPuerto(ctx, "origen", "Rotterdam, Países Bajos (NLRTM)", ROTTERDAM);
    expect(res.tarifaDesvinculada).toBe(false);
    expect(estado.tarifaId).toBe("tarifa-1");
  });
});
