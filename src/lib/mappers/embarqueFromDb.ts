/**
 * Mapeo desde la BD hacia el formulario de embarque (RHF).
 * Incluye los valores por defecto para nuevos embarques.
 */

import type { Tables } from "@/integrations/supabase/types";

type EmbarqueRow = Tables<"embarques">;

export interface EmbarqueFormValues {
  modo: string;
  tipo: string;
  clienteId: string;
  shipper: string;
  shipperManual: string;
  consignatario: string;
  consignatarioManual: string;
  incoterm: string;
  descripcionMercancia: string;
  pesoKg: string;
  volumenM3: string;
  piezas: string;
  tipoCarga: string;
  msdsArchivo: string | null;
  subiendoMsds: boolean;
  puertoOrigen: string;
  puertoDestino: string;
  naviera: string;
  tipoServicio: string;
  contenedor: string;
  tipoContenedor: string;
  agente: string;
  blMaster: string;
  blHouse: string;
  aeropuertoOrigen: string;
  aeropuertoDestino: string;
  aerolinea: string;
  mawb: string;
  hawb: string;
  ciudadOrigen: string;
  ciudadDestino: string;
  transportista: string;
  cartaPorte: string;
  etd: string;
  eta: string;
  tipoCambioUSD: string;
  tipoCambioEUR: string;
}

/** Valores iniciales para un embarque nuevo. */
export const DEFAULT_EMBARQUE_VALUES: EmbarqueFormValues = {
  modo: "", tipo: "", clienteId: "", shipper: "", shipperManual: "",
  consignatario: "", consignatarioManual: "", incoterm: "FOB", descripcionMercancia: "",
  pesoKg: "", volumenM3: "", piezas: "", tipoCarga: "Carga General",
  msdsArchivo: null, subiendoMsds: false,
  puertoOrigen: "", puertoDestino: "", naviera: "", agente: "", tipoServicio: "",
  contenedor: "", tipoContenedor: "", blMaster: "", blHouse: "",
  aeropuertoOrigen: "", aeropuertoDestino: "", aerolinea: "", mawb: "", hawb: "",
  ciudadOrigen: "", ciudadDestino: "", transportista: "", cartaPorte: "",
  etd: "", eta: "", tipoCambioUSD: "17.25", tipoCambioEUR: "18.50",
};

/** Mapea una fila de la BD al formato del formulario (para edición). */
export function mapEmbarqueRowToFormValues(embarque: EmbarqueRow): EmbarqueFormValues {
  return {
    modo: embarque.modo,
    tipo: embarque.tipo,
    clienteId: embarque.cliente_id,
    shipper: embarque.shipper,
    shipperManual: "",
    consignatario: embarque.consignatario,
    consignatarioManual: "",
    incoterm: embarque.incoterm,
    descripcionMercancia: embarque.descripcion_mercancia,
    pesoKg: String(embarque.peso_kg),
    volumenM3: String(embarque.volumen_m3),
    piezas: String(embarque.piezas),
    tipoCarga: embarque.tipo_carga ?? "Carga General",
    msdsArchivo: embarque.msds_archivo ?? null,
    subiendoMsds: false,
    puertoOrigen: embarque.puerto_origen ?? "",
    puertoDestino: embarque.puerto_destino ?? "",
    naviera: embarque.naviera ?? "",
    agente: embarque.agente ?? "",
    tipoServicio: embarque.tipo_servicio ?? "",
    contenedor: embarque.contenedor ?? "",
    tipoContenedor: embarque.tipo_contenedor ?? "",
    blMaster: embarque.bl_master ?? "",
    blHouse: embarque.bl_house ?? "",
    aeropuertoOrigen: embarque.aeropuerto_origen ?? "",
    aeropuertoDestino: embarque.aeropuerto_destino ?? "",
    aerolinea: embarque.aerolinea ?? "",
    mawb: embarque.mawb ?? "",
    hawb: embarque.hawb ?? "",
    ciudadOrigen: embarque.ciudad_origen ?? "",
    ciudadDestino: embarque.ciudad_destino ?? "",
    transportista: embarque.transportista ?? "",
    cartaPorte: embarque.carta_porte ?? "",
    etd: embarque.etd ?? "",
    eta: embarque.eta ?? "",
    tipoCambioUSD: String(embarque.tipo_cambio_usd),
    tipoCambioEUR: String(embarque.tipo_cambio_eur),
  };
}
