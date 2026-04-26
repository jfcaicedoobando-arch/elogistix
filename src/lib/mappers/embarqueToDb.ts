/**
 * Mapeo desde el formulario de embarque (RHF) hacia payloads de inserción en BD.
 */

import { resolverContacto } from "@/lib/contacto";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import type { EmbarqueFormValues } from "./embarqueFromDb";

type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;

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
