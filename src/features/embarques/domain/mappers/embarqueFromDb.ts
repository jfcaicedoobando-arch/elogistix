/**
 * Mapeo desde la BD hacia el formulario de embarque (RHF).
 * Incluye los valores por defecto para nuevos embarques.
 */

import type { Tables } from "@/integrations/supabase/types";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";
import { str, numStr } from "@/lib/mappers/_helpers";

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
  navieraId: string | null;
  tipoServicio: string;
  contenedor: string;
  tipoContenedor: string;
  /**
   * Lista dinámica de contenedores hijos (Fase G v12.8.0).
   * En FCL puede tener N filas; en LCL siempre 1 fila auto-LCL.
   * Para aéreo/terrestre queda vacío.
   */
  contenedores: ContenedorBorrador[];
  agente: string;
  agenteId: string | null;
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
  // Pack B+ (v13.33.0) — heredados de cotización
  tarifaId: string;
  cartaGarantia: boolean;
  diasLibresDestino: string;
  diasAlmacenaje: string;
  seguro: boolean;
  valorSeguroUsd: string;
  notas: string;
}

/** Valores iniciales para un embarque nuevo. */
export const DEFAULT_EMBARQUE_VALUES: EmbarqueFormValues = {
  modo: "", tipo: "", clienteId: "", shipper: "", shipperManual: "",
  consignatario: "", consignatarioManual: "", incoterm: "FOB", descripcionMercancia: "",
  pesoKg: "", volumenM3: "", piezas: "", tipoCarga: "Carga General",
  msdsArchivo: null, subiendoMsds: false,
  puertoOrigen: "", puertoDestino: "", naviera: "", navieraId: null,
  agente: "", agenteId: null, tipoServicio: "",
  contenedor: "", tipoContenedor: "", contenedores: [], blMaster: "", blHouse: "",
  aeropuertoOrigen: "", aeropuertoDestino: "", aerolinea: "", mawb: "", hawb: "",
  ciudadOrigen: "", ciudadDestino: "", transportista: "", cartaPorte: "",
  // v13.410.0 — sin T/C "mágico" por defecto: se precarga del DOF al abrir el
  // wizard y, si no hay dato, el validador obliga a capturarlo.
  etd: "", eta: "", tipoCambioUSD: "", tipoCambioEUR: "",
  // Pack B+
  tarifaId: "", cartaGarantia: false, diasLibresDestino: "0", diasAlmacenaje: "0",
  seguro: false, valorSeguroUsd: "", notas: "",
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
  // SAFE-CAST: naviera_id/agente_id son columnas nuevas (v13.303.35) que aún
  // pueden no aparecer en los tipos generados.
  const row = e as unknown as Record<string, unknown>;
  return {
    puertoOrigen: str(e.puerto_origen),
    puertoDestino: str(e.puerto_destino),
    naviera: str(e.naviera),
    navieraId: (row.naviera_id as string | null) ?? null,
    agente: str(e.agente),
    agenteId: (row.agente_id as string | null) ?? null,
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

function mapHerencia(e: EmbarqueRow) {
  // Pack B+ (v13.33.0). Columnas nuevas en `embarques`; pueden faltar en filas
  // antiguas hasta que se regeneren los tipos — accedemos como `unknown`.
  // SAFE-CAST: doble cast intencional para leer columnas opcionales de Pack B
  // que aún no aparecen en los tipos generados por Supabase.
  const row = e as unknown as Record<string, unknown>;
  return {
    tarifaId: (row.tarifa_id as string | null) ?? "",
    cartaGarantia: Boolean(row.carta_garantia),
    diasLibresDestino: String(row.dias_libres_destino ?? 0),
    diasAlmacenaje: String(row.dias_almacenaje ?? 0),
    seguro: Boolean(row.seguro),
    valorSeguroUsd: row.valor_seguro_usd != null ? String(row.valor_seguro_usd) : "",
    notas: (row.notas as string | null) ?? "",
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
    ...mapHerencia(embarque),
    // Hidratación dinámica de `contenedores` queda fuera de alcance:
    // el detail-view consume `useContenedoresEmbarque` directamente.
    contenedores: [],
  };
}

