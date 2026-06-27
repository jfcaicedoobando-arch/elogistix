import { describe, it, expect } from "vitest";
import { buildCotizacionDefaultValues, buildCotizacionInitialCostos } from "../cotizacionForm";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types";

describe("cotizacionForm.ts branches", () => {
  it("buildCotizacionDefaultValues returns defaults when no data is provided", () => {
    expect(buildCotizacionDefaultValues(undefined)).toEqual(COTIZACION_FORM_DEFAULTS);
  });

  it("covers nullish coalescing for client and prospect parts", () => {
    const data = {
      es_prospecto: true,
      cliente_id: null,
      prospecto_empresa: null,
      prospecto_contacto: null,
      prospecto_email: null,
      prospecto_telefono: null,
      modo: "Marítimo",
      tipo: "Importación",
      incoterm: "FOB",
    } as any;
    const out = buildCotizacionDefaultValues(data);
    expect(out.clienteId).toBe("");
    expect(out.prospectoEmpresa).toBe("");
    expect(out.prospectoContacto).toBe("");
    expect(out.prospectoEmail).toBe("");
    expect(out.prospectoTelefono).toBe("");
  });

  it("covers nullish coalescing for mercancia parts", () => {
    const data = {
      modo: "Aéreo",
      tipo: "Exportación",
      incoterm: "EXW",
      tipo_carga: null,
      sector_economico: null,
      descripcion_adicional: null,
      tipo_embarque: null,
      tipo_contenedor: null,
      tipo_peso: null,
      dimensiones_lcl: null,
      dimensiones_aereas: null,
      peso_kg: null,
      volumen_m3: null,
      piezas: null,
      tipo_unidad: null,
    } as any;
    const out = buildCotizacionDefaultValues(data);
    expect(out.tipoCarga).toBe("Carga General");
    expect(out.sectorEconomico).toBe("");
    expect(out.descripcionAdicional).toBe("");
    expect(out.tipoEmbarque).toBe("FCL");
    expect(out.tipoContenedor).toBe("");
    expect(out.tipoPeso).toBe("Peso Normal");
    expect(out.dimensionesLCL).toHaveLength(1);
    expect(out.dimensionesAereas).toHaveLength(1);
    expect(out.pesoKg).toBe(0);
    expect(out.volumenM3).toBe(0);
    expect(out.piezas).toBe(0);
    expect(out.tipoUnidad).toBe("");
  });

  it("covers dimensions with data", () => {
    const data = {
       modo: "Marítimo", tipo: "Importación", incoterm: "FOB",
       dimensiones_lcl: [{ piezas: 1, alto_cm: 10, largo_cm: 10, ancho_cm: 10, volumen_m3: 0.001 }],
       dimensiones_aereas: [{ piezas: 2, alto_cm: 20, largo_cm: 20, ancho_cm: 20, peso_volumetrico_kg: 5 }]
    } as any;
    const out = buildCotizacionDefaultValues(data);
    expect(out.dimensionesLCL).toHaveLength(1);
    expect(out.dimensionesLCL[0].piezas).toBe(1);
    expect(out.dimensionesAereas).toHaveLength(1);
    expect(out.dimensionesAereas[0].piezas).toBe(2);
  });

  it("covers ruta nullish coalescing", () => {
    const data = {
      modo: "Marítimo", tipo: "Importación", incoterm: "FOB",
      origen: null,
      destino: null,
      tiempo_transito_dias: null,
      frecuencia: null,
      ruta_texto: null,
      validez_propuesta: "2024-01-01",
      tipo_movimiento: null,
    } as any;
    const out = buildCotizacionDefaultValues(data);
    expect(out.origen).toBe("");
    expect(out.destino).toBe("");
    expect(out.tiempoTransitoDias).toBeUndefined();
    expect(out.frecuencia).toBe("");
    expect(out.rutaTexto).toBe("");
    expect(out.validezPropuesta).toBeInstanceOf(Date);
    expect(out.tipoMovimiento).toBe("");
  });

  it("covers extras nullish coalescing", () => {
    const data = {
      modo: "Marítimo", tipo: "Importación", incoterm: "FOB",
      seguro: null,
      valor_seguro_usd: null,
      dias_libres_destino: null,
      dias_almacenaje: null,
      carta_garantia: null,
      notas: null,
      num_contenedores: null,
      modalidad_equipo: null,
      punto_intermedio: null,
      tarifa_id: null,
      tarifa_override: null,
      sin_desglose_costos: null,
    } as any;
    const out = buildCotizacionDefaultValues(data);
    expect(out.seguro).toBe(false);
    expect(out.valorSeguroUsd).toBe(0);
    expect(out.diasLibresDestino).toBe(0);
    expect(out.diasAlmacenaje).toBe(0);
    expect(out.cartaGarantia).toBe(false);
    expect(out.notas).toBe("");
    expect(out.numContenedores).toBe(1);
    expect(out.modalidadEquipo).toBe("");
    expect(out.puntoIntermedio).toBe("");
    expect(out.tarifaId).toBeNull();
    expect(out.tarifaOverride).toEqual({});
    expect(out.sinDesgloseCostos).toBe(false);
  });

  it("buildCotizacionInitialCostos handles empty input", () => {
    expect(buildCotizacionInitialCostos(undefined)).toEqual([]);
  });
});
