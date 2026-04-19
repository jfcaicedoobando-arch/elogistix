/**
 * Mappers puros entre el formulario de embarque (RHF) y la BD.
 *
 * Extraído de useEmbarqueForm.ts para separar lógica pura de side-effects.
 * Todo lo de aquí es 100% testeable sin React.
 */

import { resolverContacto } from "@/lib/contactoUtils";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/conceptoTypes";

type EmbarqueRow = Tables<"embarques">;
type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;

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

/** Mapea valores del formulario al payload de inserción en BD. */
export function buildEmbarquePayload(
  values: EmbarqueFormValues,
  contactos: ContactoRow[],
  clienteNombre: string,
  operador: string,
): Omit<TablesInsert<"embarques">, "expediente"> {
  const v = values;
  return {
    cliente_id: v.clienteId || null!,
    cliente_nombre: clienteNombre,
    modo: v.modo as TablesInsert<"embarques">["modo"],
    tipo: v.tipo as TablesInsert<"embarques">["tipo"],
    shipper: resolverContacto(contactos, v.shipper, v.shipperManual),
    consignatario:
      v.consignatario === "__cliente__"
        ? clienteNombre
        : resolverContacto(contactos, v.consignatario, v.consignatarioManual),
    incoterm: v.incoterm as TablesInsert<"embarques">["incoterm"],
    descripcion_mercancia: v.descripcionMercancia,
    peso_kg: Number(v.pesoKg),
    volumen_m3: Number(v.volumenM3),
    piezas: Number(v.piezas),
    puerto_origen: v.puertoOrigen || null,
    puerto_destino: v.puertoDestino || null,
    naviera: v.naviera || null,
    agente: v.agente || null,
    bl_master: v.blMaster || null,
    bl_house: v.blHouse || null,
    tipo_servicio: (v.tipoServicio as TablesInsert<"embarques">["tipo_servicio"]) || null,
    contenedor: v.contenedor || null,
    tipo_contenedor: v.tipoContenedor || null,
    aeropuerto_origen: v.aeropuertoOrigen || null,
    aeropuerto_destino: v.aeropuertoDestino || null,
    aerolinea: v.aerolinea || null,
    mawb: v.mawb || null,
    hawb: v.hawb || null,
    ciudad_origen: v.ciudadOrigen || null,
    ciudad_destino: v.ciudadDestino || null,
    transportista: v.transportista || null,
    carta_porte: v.cartaPorte || null,
    etd: v.etd || null,
    eta: v.eta || null,
    tipo_cambio_usd: Number(v.tipoCambioUSD),
    tipo_cambio_eur: Number(v.tipoCambioEUR),
    tipo_carga: v.tipoCarga,
    msds_archivo: v.msdsArchivo,
    operador,
  };
}

export function buildConceptosVentaPayload(conceptosVenta: ConceptoVentaLocal[]) {
  return conceptosVenta
    .filter((v) => v.concepto)
    .map((v) => ({
      descripcion: v.concepto,
      cantidad: v.cantidad,
      precio_unitario: v.precioUnitario,
      moneda: v.moneda as TablesInsert<"conceptos_venta">["moneda"],
      total: v.cantidad * v.precioUnitario,
    }));
}

export function buildConceptosCostoPayload(
  conceptosCosto: ConceptoCostoLocal[],
  proveedoresDb: { id: string; nombre: string }[],
) {
  return conceptosCosto
    .filter((c) => c.concepto)
    .map((c) => ({
      proveedor_id: c.proveedorId || null,
      proveedor_nombre: proveedoresDb.find((p) => p.id === c.proveedorId)?.nombre || "",
      concepto: c.concepto,
      monto: c.monto,
      moneda: c.moneda as TablesInsert<"conceptos_costo">["moneda"],
    }));
}

/** Aplica los datos de una cotización al formulario (para vinculación). */
export interface CotizacionParaVincular {
  cliente_id: string | null;
  modo: string;
  tipo: string;
  incoterm: string;
  descripcion_mercancia: string;
  tipo_carga: string;
  tipo_contenedor: string | null;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  origen: string;
  destino: string;
}

/** Devuelve los pares [campo, valor] para aplicar a un formulario al vincular cotización. */
export function buildVincularCotizacionUpdates(
  cot: CotizacionParaVincular,
): Array<[keyof EmbarqueFormValues, string]> {
  return [
    ["clienteId", cot.cliente_id || ""],
    ["modo", cot.modo],
    ["tipo", cot.tipo],
    ["incoterm", cot.incoterm],
    ["descripcionMercancia", cot.descripcion_mercancia],
    ["tipoCarga", cot.tipo_carga || "Carga General"],
    ["tipoContenedor", cot.tipo_contenedor || ""],
    ["pesoKg", String(cot.peso_kg || "")],
    ["volumenM3", String(cot.volumen_m3 || "")],
    ["piezas", String(cot.piezas || "")],
    ["puertoOrigen", cot.origen || ""],
    ["puertoDestino", cot.destino || ""],
  ];
}

/** Devuelve los pares [campo, valor] para limpiar al desvincular cotización. */
export function buildDesvincularCotizacionUpdates(): Array<[keyof EmbarqueFormValues, string]> {
  return [
    ["clienteId", ""],
    ["modo", ""],
    ["tipo", ""],
    ["incoterm", "FOB"],
    ["descripcionMercancia", ""],
    ["tipoCarga", "Carga General"],
    ["tipoContenedor", ""],
    ["pesoKg", ""],
    ["volumenM3", ""],
    ["piezas", ""],
    ["puertoOrigen", ""],
    ["puertoDestino", ""],
  ];
}
