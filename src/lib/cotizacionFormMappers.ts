import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";

// ────────── Form values type ──────────
export interface CotizacionFormValues {
  esProspecto: boolean;
  clienteId: string;
  prospectoEmpresa: string;
  prospectoContacto: string;
  prospectoEmail: string;
  prospectoTelefono: string;
  modo: string;
  tipo: string;
  incoterm: string;
  tipoCarga: string;
  sectorEconomico: string;
  descripcionAdicional: string;
  tipoEmbarque: "FCL" | "LCL";
  tipoContenedor: string;
  tipoPeso: string;
  dimensionesLCL: DimensionLCL[];
  dimensionesAereas: DimensionAerea[];
  pesoKg: number;
  volumenM3: number;
  piezas: number;
  tipoUnidad: string;
  origen: string;
  destino: string;
  tiempoTransitoDias: number | undefined;
  frecuencia: string;
  rutaTexto: string;
  validezPropuesta: Date | undefined;
  tipoMovimiento: string;
  seguro: boolean;
  valorSeguroUsd: number;
  diasLibresDestino: number;
  diasAlmacenaje: number;
  cartaGarantia: boolean;
  notas: string;
  numContenedores: number;
}

export const COTIZACION_FORM_DEFAULTS: CotizacionFormValues = {
  esProspecto: false,
  clienteId: "",
  prospectoEmpresa: "",
  prospectoContacto: "",
  prospectoEmail: "",
  prospectoTelefono: "",
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  tipoCarga: "Carga General",
  sectorEconomico: "",
  descripcionAdicional: "",
  tipoEmbarque: "FCL",
  tipoContenedor: "",
  tipoPeso: "Peso Normal",
  dimensionesLCL: [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }],
  dimensionesAereas: [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 }],
  pesoKg: 0,
  volumenM3: 0,
  piezas: 0,
  tipoUnidad: "",
  origen: "",
  destino: "",
  tiempoTransitoDias: undefined,
  frecuencia: "",
  rutaTexto: "",
  validezPropuesta: undefined,
  tipoMovimiento: "",
  seguro: false,
  valorSeguroUsd: 0,
  diasLibresDestino: 0,
  diasAlmacenaje: 0,
  cartaGarantia: false,
  notas: "",
  numContenedores: 1,
};

// ────────── Initial DB shape ──────────
export interface CotizacionInitialData {
  id: string;
  estado: string;
  folio: string;
  es_prospecto: boolean;
  cliente_id: string | null;
  prospecto_empresa: string;
  prospecto_contacto: string;
  prospecto_email: string;
  prospecto_telefono: string;
  modo: string;
  tipo: string;
  incoterm: string;
  tipo_carga: string;
  sector_economico: string;
  descripcion_adicional: string;
  tipo_embarque: string;
  tipo_contenedor: string | null;
  tipo_peso: string;
  dimensiones_lcl: DimensionLCL[];
  dimensiones_aereas: DimensionAerea[];
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  tipo_unidad: string | null;
  origen: string;
  destino: string;
  tiempo_transito_dias: number | null;
  frecuencia: string;
  ruta_texto: string;
  validez_propuesta: string | null;
  tipo_movimiento: string;
  seguro: boolean;
  valor_seguro_usd: number;
  dias_libres_destino: number;
  dias_almacenaje: number;
  carta_garantia: boolean;
  notas: string | null;
  num_contenedores: number;
  conceptos_venta: ConceptoVentaCotizacion[];
  msds_archivo: string | null;
}

export interface CotizacionInitialCosto {
  concepto: string;
  moneda: string;
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta?: number;
  unidad_medida?: string;
}

export function buildCotizacionDefaultValues(d?: CotizacionInitialData): CotizacionFormValues {
  if (!d) return COTIZACION_FORM_DEFAULTS;
  return {
    esProspecto: d.es_prospecto,
    clienteId: d.cliente_id ?? "",
    prospectoEmpresa: d.prospecto_empresa ?? "",
    prospectoContacto: d.prospecto_contacto ?? "",
    prospectoEmail: d.prospecto_email ?? "",
    prospectoTelefono: d.prospecto_telefono ?? "",
    modo: d.modo,
    tipo: d.tipo,
    incoterm: d.incoterm,
    tipoCarga: d.tipo_carga ?? "Carga General",
    sectorEconomico: d.sector_economico ?? "",
    descripcionAdicional: d.descripcion_adicional ?? "",
    tipoEmbarque: (d.tipo_embarque as "FCL" | "LCL") ?? "FCL",
    tipoContenedor: d.tipo_contenedor ?? "",
    tipoPeso: d.tipo_peso ?? "Peso Normal",
    dimensionesLCL: (d.dimensiones_lcl as DimensionLCL[])?.length
      ? (d.dimensiones_lcl as DimensionLCL[])
      : [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }],
    dimensionesAereas: (d.dimensiones_aereas as DimensionAerea[])?.length
      ? (d.dimensiones_aereas as DimensionAerea[])
      : [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0 }],
    pesoKg: d.peso_kg ?? 0,
    volumenM3: d.volumen_m3 ?? 0,
    piezas: d.piezas ?? 0,
    tipoUnidad: d.tipo_unidad ?? "",
    origen: d.origen ?? "",
    destino: d.destino ?? "",
    tiempoTransitoDias: d.tiempo_transito_dias ?? undefined,
    frecuencia: d.frecuencia ?? "",
    rutaTexto: d.ruta_texto ?? "",
    validezPropuesta: d.validez_propuesta ? new Date(d.validez_propuesta) : undefined,
    tipoMovimiento: d.tipo_movimiento ?? "",
    seguro: d.seguro ?? false,
    valorSeguroUsd: d.valor_seguro_usd ?? 0,
    diasLibresDestino: d.dias_libres_destino ?? 0,
    diasAlmacenaje: d.dias_almacenaje ?? 0,
    cartaGarantia: d.carta_garantia ?? false,
    notas: d.notas ?? "",
    numContenedores: d.num_contenedores ?? 1,
  };
}

export function buildCotizacionInitialCostos(initialCostos?: CotizacionInitialCosto[]): FilaCostoLocal[] {
  return (initialCostos ?? []).map((c, i) => ({
    _key: `init-${i}`,
    concepto: c.concepto,
    moneda: c.moneda as "USD" | "MXN",
    proveedor: c.proveedor,
    cantidad: c.cantidad,
    costo_unitario: c.costo_unitario,
    precio_venta: c.precio_venta ?? 0,
    unidad_medida: c.unidad_medida ?? "Contenedor",
  }));
}
