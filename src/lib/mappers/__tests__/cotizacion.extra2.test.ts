/**
 * cotizacion.extra2 — edge cases y branches no cubiertos en cotizacion.test.ts
 * ni en cotizacionBuildPaso1.test.ts ni cotizacionPaso1.test.ts.
 * Foco: cliente no encontrado en catálogo, campos terrestre, campos LCL/Aéreo vacíos
 * con dimensiones, vigenciaDias futuro, partesMercancia flags, notas, etc.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { buildPaso1Data } from "@/lib/mappers/cotizacion";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

const CLIENTES = [{ id: "c1", nombre: "Empresa ABC" }];

function vals(over: Partial<CotizacionFormValues> = {}): CotizacionFormValues {
  return { ...COTIZACION_FORM_DEFAULTS, clienteId: "c1", ...over } as CotizacionFormValues;
}

afterEach(() => { vi.restoreAllMocks(); });

// ─── partesCliente ───────────────────────────────────────────────────────────

describe("cotizacion.extra2 — partesCliente", () => {
  it("[EC-01] cliente_nombre es string vacío cuando el id no existe en catálogo", () => {
    const r = buildPaso1Data(vals({ clienteId: "ghost" }), CLIENTES, "op@x");
    expect(r.cliente_nombre).toBe("");
    expect(r.cliente_id).toBe("ghost");
  });

  it("[EC-02] prospecto: todos los campos prospecto se rellenan correctamente", () => {
    const r = buildPaso1Data(
      vals({
        esProspecto: true,
        prospectoEmpresa: "Acme",
        prospectoContacto: "Juan",
        prospectoEmail: "j@acme.com",
        prospectoTelefono: "5551234",
      }),
      CLIENTES,
      "op@x",
    );
    expect(r.prospecto_contacto).toBe("Juan");
    expect(r.prospecto_telefono).toBe("5551234");
  });

  it("[EC-03] no-prospecto: campos prospecto son strings vacíos", () => {
    const r = buildPaso1Data(vals({ esProspecto: false }), CLIENTES, "op@x");
    expect(r.prospecto_contacto).toBe("");
    expect(r.prospecto_email).toBe("");
    expect(r.prospecto_telefono).toBe("");
  });
});

// ─── partesMercancia ─────────────────────────────────────────────────────────

describe("cotizacion.extra2 — partesMercancia", () => {
  it("[EC-04] modo no-Marítimo: tipo_embarque siempre FCL", () => {
    const r = buildPaso1Data(vals({ modo: "Aéreo" }), CLIENTES, "op@x");
    expect(r.tipo_embarque).toBe("FCL");
  });

  it("[EC-05] Terrestre: tipo_unidad se incluye en el payload", () => {
    const r = buildPaso1Data(vals({ modo: "Terrestre", tipoUnidad: "Torton" }), CLIENTES, "op@x");
    expect(r.tipo_unidad).toBe("Torton");
  });

  it("[EC-06] modo Marítimo: tipo_unidad es null", () => {
    const r = buildPaso1Data(vals({ modo: "Marítimo", tipoEmbarque: "FCL", tipoUnidad: "Torton" }), CLIENTES, "op@x");
    expect(r.tipo_unidad).toBeNull();
  });

  it("[EC-07] FCL: dias_almacenaje forzado a 0, carta_garantia respeta el valor form", () => {
    const r = buildPaso1Data(
      vals({ modo: "Marítimo", tipoEmbarque: "FCL", diasAlmacenaje: 99, cartaGarantia: true }),
      CLIENTES,
      "op@x",
    );
    expect(r.dias_almacenaje).toBe(0);
    expect(r.carta_garantia).toBe(true);
  });

  it("[EC-08] LCL: dias_libres_destino=0 y carta_garantia=false sin importar form", () => {
    const r = buildPaso1Data(
      vals({ modo: "Marítimo", tipoEmbarque: "LCL", diasLibresDestino: 10, cartaGarantia: true }),
      CLIENTES,
      "op@x",
    );
    expect(r.dias_libres_destino).toBe(0);
    expect(r.carta_garantia).toBe(false);
  });

  it("[EC-09] Aéreo: dimensiones_aereas se incluyen y dimensiones_lcl vacías", () => {
    const dims = [{ piezas: 1, alto_cm: 10, largo_cm: 10, ancho_cm: 10, peso_volumetrico_kg: 5 }];
    const r = buildPaso1Data(vals({ modo: "Aéreo", dimensionesAereas: dims }), CLIENTES, "op@x");
    expect(r.dimensiones_aereas).toEqual(dims);
    expect(r.dimensiones_lcl).toEqual([]);
  });
});

// ─── partesRuta ──────────────────────────────────────────────────────────────

describe("cotizacion.extra2 — partesRuta", () => {
  it("[EC-10] Terrestre: modalidadEquipo y puntoIntermedio se incluyen", () => {
    const r = buildPaso1Data(
      vals({ modo: "Terrestre", modalidadEquipo: "Sencillo", puntoIntermedio: "Guadalajara" }),
      CLIENTES,
      "op@x",
    );
    expect(r.modalidad_equipo).toBe("Sencillo");
    expect(r.punto_intermedio).toBe("Guadalajara");
  });
});
