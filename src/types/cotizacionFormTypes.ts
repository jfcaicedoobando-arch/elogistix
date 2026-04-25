/**
 * Tipos del formulario de Cotización (capa neutra, sin dependencias UI).
 * Movido desde src/lib/cotizacionFormMappers.ts para romper la inversión de
 * dependencia (lib no debe importar tipos desde components).
 */
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "@/types/cotizacionTypes";

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
