/**
 * Mapeo desde la BD hacia el formulario de embarque (RHF).
 * Incluye los valores por defecto para nuevos embarques.
 */

import type { Tables } from "@/integrations/supabase/types";
import { str, numStr } from "./_helpers";

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

// Sub-mappers por sección — extraen los `?? ""` fuera del mapper principal
// para mantener la complejidad ciclomática <15.

function mapDatosGenerales(e: EmbarqueRow) {
  return {
    modo: e.modo,
    tipo: e.tipo,
    clienteId: e.cliente_id,
    shipper: e.shipper,
    shipperManual: "",
    consignatario: e.consignatario,
    consignatarioManual: "",
    incoterm: e.incoterm,
    descripcionMercancia: e.descripcion_mercancia,
    pesoKg: String(e.peso_kg),
    volumenM3: String(e.volumen_m3),
    piezas: String(e.piezas),
    tipoCarga: str(e.tipo_carga, "Carga General"),
    msdsArchivo: e.msds_archivo ?? null,
    subiendoMsds: false,
  };
}

function mapMaritimo(e: EmbarqueRow) {
  return {
    puertoOrigen: str(e.puerto_origen),
    puertoDestino: str(e.puerto_destino),
    naviera: str(e.naviera),
    agente: str(e.agente),
    tipoServicio: str(e.tipo_servicio),
    contenedor: str(e.contenedor),
    tipoContenedor: str(e.tipo_contenedor),
    blMaster: str(e.bl_master),
    blHouse: str(e.bl_house),
  };
}

function mapAereo(e: EmbarqueRow) {
  return {
    aeropuertoOrigen: str(e.aeropuerto_origen),
    aeropuertoDestino: str(e.aeropuerto_destino),
    aerolinea: str(e.aerolinea),
    mawb: str(e.mawb),
    hawb: str(e.hawb),
  };
}

function mapTerrestre(e: EmbarqueRow) {
  return {
    ciudadOrigen: str(e.ciudad_origen),
    ciudadDestino: str(e.ciudad_destino),
    transportista: str(e.transportista),
    cartaPorte: str(e.carta_porte),
  };
}

function mapFechasFinancieras(e: EmbarqueRow) {
  return {
    etd: str(e.etd),
    eta: str(e.eta),
    tipoCambioUSD: numStr(e.tipo_cambio_usd),
    tipoCambioEUR: numStr(e.tipo_cambio_eur),
  };
}

/** Mapea una fila de la BD al formato del formulario (para edición). */
export function mapEmbarqueRowToFormValues(embarque: EmbarqueRow): EmbarqueFormValues {
  return {
    ...mapDatosGenerales(embarque),
    ...mapMaritimo(embarque),
    ...mapAereo(embarque),
    ...mapTerrestre(embarque),
    ...mapFechasFinancieras(embarque),
  };
}
