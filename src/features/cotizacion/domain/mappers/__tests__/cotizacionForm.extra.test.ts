/**
 * cotizacionForm.extra — edge cases no cubiertos en cotizacionForm.test.ts.
 */
import { describe, it, expect } from "vitest";
import { buildCotizacionDefaultValues, buildCotizacionInitialCostos } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { CotizacionInitialData } from "@/features/cotizacion/types";

function baseData(over: Partial<CotizacionInitialData> = {}): CotizacionInitialData {
  return {
    id: "c1", estado: "vigente", folio: "COT-1",
    es_prospecto: false, cliente_id: "cli-1",
    prospecto_empresa: "", prospecto_contacto: "", prospecto_email: "", prospecto_telefono: "",
    modo: "Marítimo", tipo: "Importación", incoterm: "FOB",
    tipo_carga: "Carga General", sector_economico: "", descripcion_adicional: "",
    tipo_embarque: "FCL", tipo_contenedor: null, tipo_peso: "Peso Normal",
    dimensiones_lcl: [], dimensiones_aereas: [],
    peso_kg: 0, volumen_m3: 0, piezas: 0, tipo_unidad: null,
    origen: "", destino: "", tiempo_transito_dias: null,
    frecuencia: "", ruta_texto: "", validez_propuesta: null,
    tipo_movimiento: "", seguro: false, valor_seguro_usd: 0,
    dias_libres_destino: 0, dias_almacenaje: 0, carta_garantia: false,
    notas: null, num_contenedores: 1, conceptos_venta: [], msds_archivo: null,
    ...over,
  };
}

describe("cotizacionForm.extra — prospecto", () => {
  it("[CF-01] es_prospecto=true: todos los campos prospecto se mapean a camelCase", () => {
    const out = buildCotizacionDefaultValues(
      baseData({ es_prospecto: true, prospecto_empresa: "StartupX", prospecto_contacto: "María",
                  prospecto_email: "m@sx.com", prospecto_telefono: "5559999" }),
    );
    expect(out.esProspecto).toBe(true);
    expect(out.prospectoEmpresa).toBe("StartupX");
    expect(out.prospectoContacto).toBe("María");
    expect(out.prospectoEmail).toBe("m@sx.com");
    expect(out.prospectoTelefono).toBe("5559999");
  });

  it("[CF-02] prospectoModo siempre es 'vincular' (no se crean leads desde el cotizador)", () => {
    const out = buildCotizacionDefaultValues(baseData({ es_prospecto: false }));
    expect(out.prospectoModo).toBe("vincular");
  });
});

describe("cotizacionForm.extra — extras", () => {
  it("[CF-03] seguro=true y valor_seguro_usd se mapean", () => {
    const out = buildCotizacionDefaultValues(baseData({ seguro: true, valor_seguro_usd: 8500 }));
    expect(out.seguro).toBe(true);
    expect(out.valorSeguroUsd).toBe(8500);
  });

  it("[CF-04] dias_libres_destino y dias_almacenaje se mapean", () => {
    const out = buildCotizacionDefaultValues(baseData({ dias_libres_destino: 7, dias_almacenaje: 14 }));
    expect(out.diasLibresDestino).toBe(7);
    expect(out.diasAlmacenaje).toBe(14);
  });

  it("[CF-05] carta_garantia=true se mapea", () => {
    const out = buildCotizacionDefaultValues(baseData({ carta_garantia: true }));
    expect(out.cartaGarantia).toBe(true);
  });

  it("[CF-06] num_contenedores se respeta", () => {
    const out = buildCotizacionDefaultValues(baseData({ num_contenedores: 3 }));
    expect(out.numContenedores).toBe(3);
  });

  it("[CF-07] modalidad_equipo y punto_intermedio con valores se mapean", () => {
    const out = buildCotizacionDefaultValues(
      baseData({ modalidad_equipo: "Sencillo", punto_intermedio: "Guadalajara" }),
    );
    expect(out.modalidadEquipo).toBe("Sencillo");
    expect(out.puntoIntermedio).toBe("Guadalajara");
  });

  it("[CF-08] tiempo_transito_dias null resulta en undefined en el form", () => {
    const out = buildCotizacionDefaultValues(baseData({ tiempo_transito_dias: null }));
    expect(out.tiempoTransitoDias).toBeUndefined();
  });
});

describe("cotizacionForm.extra — buildCotizacionInitialCostos", () => {
  it("[CF-09] múltiples costos se mapean preservando el orden", () => {
    const out = buildCotizacionInitialCostos([
      { concepto: "Flete", moneda: "USD", proveedor: "COSCO", cantidad: 1, costo_unitario: 2000, precio_venta: 2400, unidad_medida: "Contenedor" },
      { concepto: "THC",   moneda: "MXN", proveedor: "Puerto", cantidad: 1, costo_unitario: 800,  precio_venta: 0,    unidad_medida: "BL" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].concepto).toBe("Flete");
    expect(out[1].moneda).toBe("MXN");
    expect(out[1].unidad_medida).toBe("BL");
  });

  it("[CF-10] precio_venta null → 0 y unidad_medida null → 'Contenedor'", () => {
    const out = buildCotizacionInitialCostos([
      { concepto: "Seguro", moneda: "USD", proveedor: "Seg", cantidad: 1, costo_unitario: 100 },
    ]);
    expect(out[0].precio_venta).toBe(0);
    expect(out[0].unidad_medida).toBe("Contenedor");
  });
});
