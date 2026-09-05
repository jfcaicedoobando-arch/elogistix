/**
 * Piezas del payload de inserción de embarque (base, por modo de transporte,
 * financieras y heredadas de cotización). Extraído de `embarqueToDb.ts` para
 * mantenerlo bajo el límite de líneas (Power-of-10); sin cambios de lógica.
 */
import { resolverContacto } from "@/features/cliente/domain/contacto";
import type { Tables } from "@/integrations/supabase/types";
import type { EmbarqueFormValues } from "./embarqueFromDb";
import { emptyToNull } from "@/lib/mappers/_helpers";
import { incotermSchema, modoEmbarqueSchema, tipoOperacionSchema, tipoServicioMaritimoSchema } from "./embarquePayloadSchemas";

export type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;

export function partesBase(v: EmbarqueFormValues, contactos: ContactoRow[], clienteNombre: string) {
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

export function partesMaritimo(v: EmbarqueFormValues) {
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

export function totalesDesdeContenedores(v: EmbarqueFormValues) {
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
    // v13.823.151 (B4) — Los contenedores son la única verdad en FCL (igual que
    // el trigger `_recompute_totales_embarque` en BD): la suma se respeta tal
    // cual, incluso en cero, para que corregir a cero sea posible de forma
    // explícita. La pérdida silenciosa se evita sembrando el primer contenedor
    // con las cantidades generales al cambiar a FCL (ver `semillaContenedor.ts`).
    return { peso_kg: peso, volumen_m3: vol, piezas: pzs };
  }
  return generales;
}

export function partesAereo(v: EmbarqueFormValues) {
  return {
    aeropuerto_origen: emptyToNull(v.aeropuertoOrigen),
    aeropuerto_destino: emptyToNull(v.aeropuertoDestino),
    aerolinea: emptyToNull(v.aerolinea),
    mawb: emptyToNull(v.mawb),
    hawb: emptyToNull(v.hawb),
  };
}

export function partesTerrestre(v: EmbarqueFormValues) {
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

export function partesFinancieras(v: EmbarqueFormValues) {
  return {
    etd: emptyToNull(v.etd),
    eta: emptyToNull(v.eta),
    tipo_cambio_usd: tcOrNull(v.tipoCambioUSD),
    tipo_cambio_eur: tcOrNull(v.tipoCambioEUR),
  };
}

// Pack B+ (v13.33.0): campos heredados de cotización persistidos en `embarques`.
export function partesHerencia(v: EmbarqueFormValues) {
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
