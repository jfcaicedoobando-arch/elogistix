/**
 * Mapeo desde el formulario de embarque (RHF) hacia payloads de inserción en BD.
 *
 * Validación runtime (P1.7): los enums (`modo`, `tipo`, `incoterm`,
 * `tipoServicio`, `moneda`) se validan con Zod antes de enviar a Supabase
 * para dar errores claros en vez de propagar valores inválidos al backend.
 */

import { resolverContacto } from "@/features/cliente/domain/contacto";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import type { EmbarqueFormValues } from "./embarqueFromDb";
import { emptyToNull } from "@/lib/mappers/_helpers";
// BL-12: canon monetario — nunca `cantidad * precio` crudo (drift float).
import { subtotalLinea } from "@/lib/financial/financialUtils";
import {
  modoEmbarqueSchema,
  tipoOperacionSchema,
  incotermSchema,
  tipoServicioMaritimoSchema,
  monedaSchema,
  monedaVentaSchema,
} from "./embarquePayloadSchemas";

type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;
type EmbarqueInsert = Omit<TablesInsert<"embarques">, "expediente">;

function partesBase(v: EmbarqueFormValues, contactos: ContactoRow[], clienteNombre: string) {
  return {
    cliente_id: v.clienteId || null!,
    cliente_nombre: clienteNombre,
    modo: modoEmbarqueSchema.parse(v.modo),
    tipo: tipoOperacionSchema.parse(v.tipo),
    shipper: resolverContacto(contactos, v.shipper, v.shipperManual),
    consignatario:
      v.consignatario === "__cliente__"
        ? clienteNombre
        : resolverContacto(contactos, v.consignatario, v.consignatarioManual),
    incoterm: incotermSchema.parse(v.incoterm),
    descripcion_mercancia: v.descripcionMercancia,
    peso_kg: Number(v.pesoKg),
    volumen_m3: Number(v.volumenM3),
    piezas: Number(v.piezas),
    tipo_carga: v.tipoCarga,
    msds_archivo: v.msdsArchivo,
  };
}

function partesMaritimo(v: EmbarqueFormValues) {
  // v12.8.0: si hay contenedores dinámicos, derivar campos legacy del primero
  // (el trigger DB después los re-sincroniza, esto sólo cubre el insert inmediato).
  const primero = v.contenedores?.[0];
  const numero = primero?.numero_contenedor ?? v.contenedor;
  const tipo =
    v.tipoServicio === "LCL"
      ? "LCL"
      : primero?.tipo_contenedor ?? v.tipoContenedor;
  return {
    puerto_origen: emptyToNull(v.puertoOrigen),
    puerto_destino: emptyToNull(v.puertoDestino),
    naviera: emptyToNull(v.naviera),
    naviera_id: v.navieraId ?? null,
    agente: emptyToNull(v.agente),
    agente_id: v.agenteId ?? null,
    bl_master: emptyToNull(v.blMaster),
    bl_house: emptyToNull(v.blHouse),
    tipo_servicio: tipoServicioMaritimoSchema.optional().nullable().parse(emptyToNull(v.tipoServicio)) ?? null,
    contenedor: emptyToNull(numero),
    tipo_contenedor: emptyToNull(tipo),
  };
}

function totalesDesdeContenedores(v: EmbarqueFormValues) {
  const generales = {
    peso_kg: Number(v.pesoKg) || 0,
    volumen_m3: Number(v.volumenM3) || 0,
    piezas: Number(v.piezas) || 0,
  };
  // FCL con contenedores dinámicos → suma; caso contrario → usa campos legacy.
  if (v.modo === "Marítimo" && v.contenedores && v.contenedores.length > 0) {
    const peso = v.contenedores.reduce((s, c) => s + (Number(c.peso_kg) || 0), 0);
    const vol = v.contenedores.reduce((s, c) => s + (Number(c.volumen_m3) || 0), 0);
    const pzs = v.contenedores.reduce((s, c) => s + (Number(c.piezas) || 0), 0);
    // v13.823.145 — Si las filas hijas están en ceros (aún sin capturar), NO
    // borramos los totales generales capturados en Datos generales.
    return {
      peso_kg: peso > 0 ? peso : generales.peso_kg,
      volumen_m3: vol > 0 ? vol : generales.volumen_m3,
      piezas: pzs > 0 ? pzs : generales.piezas,
    };
  }
  return generales;
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

const tcOrNull = (raw: unknown): number | null => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function partesFinancieras(v: EmbarqueFormValues) {
  return {
    etd: emptyToNull(v.etd),
    eta: emptyToNull(v.eta),
    tipo_cambio_usd: tcOrNull(v.tipoCambioUSD),
    tipo_cambio_eur: tcOrNull(v.tipoCambioEUR),
  };
}

// Pack B+ (v13.33.0): campos heredados de cotización persistidos en `embarques`.
function partesHerencia(v: EmbarqueFormValues) {
  return {
    tarifa_id: emptyToNull(v.tarifaId),
    carta_garantia: Boolean(v.cartaGarantia),
    dias_libres_destino: Number(v.diasLibresDestino) || 0,
    dias_almacenaje: Number(v.diasAlmacenaje) || 0,
    seguro: Boolean(v.seguro),
    valor_seguro_usd: v.valorSeguroUsd ? Number(v.valorSeguroUsd) : null,
    notas: emptyToNull(v.notas),
  } as Record<string, unknown>;
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
    ...partesHerencia(values),
    ...totalesDesdeContenedores(values),
    operador,
  } as EmbarqueInsert;
}


export function buildConceptosVentaPayload(conceptosVenta: ConceptoVentaLocal[]) {
  return conceptosVenta
    .filter((v) => v.concepto)
    .map((v) => ({
      // v13.207.0 — Enviamos el UUID de BD (si existe) para que el RPC
      // `actualizar_embarque_completo` haga merge en sitio y NO borre
      // conceptos que ya estén facturados.
      ...(v.dbId ? { id: v.dbId } : {}),
      descripcion: v.concepto,
      cantidad: v.cantidad,
      precio_unitario: v.precioUnitario,
      moneda: monedaVentaSchema.parse(v.moneda),
      total: subtotalLinea(v.cantidad, v.precioUnitario),
      contenedor_id: v.contenedorId ?? null,
    }));
}

export function buildConceptosCostoPayload(
  conceptosCosto: ConceptoCostoLocal[],
  proveedoresDb: { id: string; nombre: string }[],
) {
  return conceptosCosto
    .filter((c) => c.concepto)
    .map((c) => {
      // v13.509.0 — Si el costo no tiene proveedor de catálogo (típico en
      // costos replicados desde cotización), conservamos el nombre heredado
      // en vez de mandar cadena vacía y borrarlo en BD.
      const nombreCatalogo = proveedoresDb.find((p) => p.id === c.proveedorId)?.nombre;
      const nombre = (nombreCatalogo ?? c.proveedorNombre ?? "").trim();
      return {
        ...(c.dbId ? { id: c.dbId } : {}),
        proveedor_id: c.proveedorId || null,
        proveedor_nombre: nombre,
        concepto: c.concepto,
        monto: c.monto,
        moneda: monedaSchema.parse(c.moneda),
        contenedor_id: c.contenedorId ?? null,
      };
    });
}
