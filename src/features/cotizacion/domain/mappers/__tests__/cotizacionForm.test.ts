import { describe, it, expect } from "vitest";
import {
  buildCotizacionDefaultValues,
  buildCotizacionInitialCostos,
  COTIZACION_FORM_DEFAULTS,
} from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { CotizacionInitialData } from "@/features/cotizacion/types";

function baseData(overrides: Partial<CotizacionInitialData> = {}): CotizacionInitialData {
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
    ...overrides,
  };
}

describe("buildCotizacionDefaultValues", () => {
  it("retorna defaults cuando no hay data", () => {
    expect(buildCotizacionDefaultValues()).toEqual(COTIZACION_FORM_DEFAULTS);
  });

  it("mapea snake_case → camelCase respetando cliente_id", () => {
    const out = buildCotizacionDefaultValues(baseData({ cliente_id: "cli-9", sector_economico: "Auto" }));
    expect(out.clienteId).toBe("cli-9");
    expect(out.sectorEconomico).toBe("Auto");
    expect(out.esProspecto).toBe(false);
  });

  it("inyecta dimensión LCL/Aérea default cuando arrays vienen vacíos", () => {
    const out = buildCotizacionDefaultValues(baseData());
    expect(out.dimensionesLCL).toHaveLength(1);
    expect(out.dimensionesLCL[0].piezas).toBe(0);
    expect(out.dimensionesAereas).toHaveLength(1);
  });

  it("respeta dimensiones existentes", () => {
    const out = buildCotizacionDefaultValues(
      baseData({
        dimensiones_lcl: [{ piezas: 3, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 1.2 }],
      }),
    );
    expect(out.dimensionesLCL).toHaveLength(1);
    expect(out.dimensionesLCL[0].piezas).toBe(3);
  });

  it("parsea validez_propuesta a Date", () => {
    const out = buildCotizacionDefaultValues(baseData({ validez_propuesta: "2026-12-31" }));
    expect(out.validezPropuesta).toBeInstanceOf(Date);
  });

  it("aplica fallbacks de string/number ante null/undefined", () => {
    const out = buildCotizacionDefaultValues(baseData({ notas: null, tipo_unidad: null, tipo_contenedor: null }));
    expect(out.notas).toBe("");
    expect(out.tipoUnidad).toBe("");
    expect(out.tipoContenedor).toBe("");
  });
});

describe("buildCotizacionInitialCostos", () => {
  it("retorna [] cuando no hay costos", () => {
    expect(buildCotizacionInitialCostos()).toEqual([]);
    expect(buildCotizacionInitialCostos([])).toEqual([]);
  });

  it("mapea costos con defaults para precio_venta y unidad_medida", () => {
    const out = buildCotizacionInitialCostos([
      { concepto: "Flete", moneda: "USD", proveedor: "X", cantidad: 1, costo_unitario: 100 },
    ]);
    expect(out[0]).toEqual({
      concepto: "Flete", moneda: "USD", proveedor: "X",
      cantidad: 1, costo_unitario: 100, precio_venta: 0, unidad_medida: "Contenedor",
      notas: "",
    });
  });

  it("respeta precio_venta y unidad_medida cuando vienen", () => {
    const out = buildCotizacionInitialCostos([
      { concepto: "X", moneda: "MXN", proveedor: "P", cantidad: 2, costo_unitario: 50, precio_venta: 70, unidad_medida: "Kg" },
    ]);
    expect(out[0].precio_venta).toBe(70);
    expect(out[0].unidad_medida).toBe("Kg");
  });

  // P2 (13.823.159): la nota guardada debe rehidratarse al editar; antes se
  // omitía y el siguiente guardado la dejaba vacía.
  it("restaura la nota persistida del costo", () => {
    const out = buildCotizacionInitialCostos([
      { concepto: "Despacho", moneda: "MXN", proveedor: "P", cantidad: 1, costo_unitario: 500, notas: "costo sin venta" },
    ]);
    expect(out[0].notas).toBe("costo sin venta");
  });
});
