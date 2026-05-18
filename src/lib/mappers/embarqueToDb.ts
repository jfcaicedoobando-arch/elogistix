/**
 * Mapeo desde el formulario de embarque (RHF) hacia payloads de inserción en BD.
 */

import { resolverContacto } from "@/lib/contacto";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import type { EmbarqueFormValues } from "./embarqueFromDb";
import { emptyToNull } from "./_helpers";

type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;
type EmbarqueInsert = Omit<TablesInsert<"embarques">, "expediente">;

function partesBase(v: EmbarqueFormValues, contactos: ContactoRow[], clienteNombre: string) {
  return {
    cliente_id: v.clienteId || null!,
    cliente_nombre: clienteNombre,
    modo: v.modo as EmbarqueInsert["modo"],
    tipo: v.tipo as EmbarqueInsert["tipo"],
    shipper: resolverContacto(contactos, v.shipper, v.shipperManual),
    consignatario:
      v.consignatario === "__cliente__"
        ? clienteNombre
        : resolverContacto(contactos, v.consignatario, v.consignatarioManual),
    incoterm: v.incoterm as EmbarqueInsert["incoterm"],
    descripcion_mercancia: v.descripcionMercancia,
    peso_kg: Number(v.pesoKg),
    volumen_m3: Number(v.volumenM3),
    piezas: Number(v.piezas),
    tipo_carga: v.tipoCarga,
    msds_archivo: v.msdsArchivo,
  };
}

function partesMaritimo(v: EmbarqueFormValues) {
  return {
    puerto_origen: emptyToNull(v.puertoOrigen),
    puerto_destino: emptyToNull(v.puertoDestino),
    naviera: emptyToNull(v.naviera),
    agente: emptyToNull(v.agente),
    bl_master: emptyToNull(v.blMaster),
    bl_house: emptyToNull(v.blHouse),
    tipo_servicio: (emptyToNull(v.tipoServicio) as EmbarqueInsert["tipo_servicio"]) ?? null,
    contenedor: emptyToNull(v.contenedor),
    tipo_contenedor: emptyToNull(v.tipoContenedor),
  };
}

function partesAereo(v: EmbarqueFormValues) {
  return {
    aeropuerto_origen: emptyToNull(v.aeropuertoOrigen),
    aeropuerto_destino: emptyToNull(v.aeropuertoDestino),
    aerolinea: emptyToNull(v.aerolinea),
    mawb: emptyToNull(v.mawb),
    hawb: emptyToNull(v.hawb),
  };
}

function partesTerrestre(v: EmbarqueFormValues) {
  return {
    ciudad_origen: emptyToNull(v.ciudadOrigen),
    ciudad_destino: emptyToNull(v.ciudadDestino),
    transportista: emptyToNull(v.transportista),
    carta_porte: emptyToNull(v.cartaPorte),
  };
}

function partesFinancieras(v: EmbarqueFormValues) {
  return {
    etd: emptyToNull(v.etd),
    eta: emptyToNull(v.eta),
    tipo_cambio_usd: Number(v.tipoCambioUSD),
    tipo_cambio_eur: Number(v.tipoCambioEUR),
  };
}

/** Mapea valores del formulario al payload de inserción en BD. */
export function buildEmbarquePayload(
  values: EmbarqueFormValues,
  contactos: ContactoRow[],
  clienteNombre: string,
  operador: string,
): EmbarqueInsert {
  return {
    ...partesBase(values, contactos, clienteNombre),
    ...partesMaritimo(values),
    ...partesAereo(values),
    ...partesTerrestre(values),
    ...partesFinancieras(values),
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
