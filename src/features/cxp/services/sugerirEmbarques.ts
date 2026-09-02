/**
 * Sugerencias de embarque para vincular una factura de proveedor cuando NO
 * hay conceptos_costo pendientes. Usa la RPC `sugerir_embarques_para_proveedor`
 * (SECURITY DEFINER) que rankea por:
 *   - Match directo por nombre en `embarques.agente/naviera/transportista/aerolinea` (100)
 *   - Tarifa aplicada → agente.proveedor_id (80)
 *   - Tarifa aplicada → naviera condiciones.proveedor_id (80)
 *
 * Además expone `buscarEmbarquesPorTexto` para el modo manual del UI.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { Moneda } from "@/types/db";

/**
 * Estados de embarque que NO pueden recibir costos nuevos desde una factura
 * de proveedor. Espejo del filtro de la RPC `sugerir_embarques_para_proveedor`
 * y del trigger `bloquear_conceptos_en_embarque_cerrado`.
 * `Entregado` y `Por liquidar` SÍ se permiten: todavía reciben facturas.
 */
export const ESTADOS_EMBARQUE_NO_VINCULABLES = ["Cerrado", "Cancelado"] as const;

/** Filtro PostgREST `in (...)` para los estados no vinculables. */
export const FILTRO_ESTADOS_NO_VINCULABLES =
  `(${ESTADOS_EMBARQUE_NO_VINCULABLES.join(",")})`;

/** `true` si el estado del embarque impide vincularle costos nuevos. */
export function esEstadoNoVinculable(estado: string | null | undefined): boolean {
  return !!estado && (ESTADOS_EMBARQUE_NO_VINCULABLES as readonly string[]).includes(estado);
}

export interface EmbarqueSugerido {
  embarque_id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  estado: string | null;
  etd: string | null;
  eta: string | null;
  match_tipo: string;
  score: number;
}

export async function sugerirEmbarquesParaProveedor(
  proveedorId: string,
  organizationId: string | null,
  limit = 10,
): Promise<EmbarqueSugerido[]> {
  if (!proveedorId || !organizationId) return [];
  const { data, error } = await supabase.rpc("sugerir_embarques_para_proveedor", {
    _proveedor_id: proveedorId,
    _organization_id: organizationId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as EmbarqueSugerido[];
}

export async function buscarEmbarquesPorTexto(
  q: string,
  organizationId: string | null,
  limit = 8,
): Promise<EmbarqueSugerido[]> {
  const term = q.trim();
  if (!term || !organizationId) return [];
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, cliente_nombre, estado, etd, eta, bl_master, bl_house")
    .eq("organization_id", organizationId)
    .not("estado", "in", FILTRO_ESTADOS_NO_VINCULABLES)
    .or(
      `expediente.ilike.%${term}%,bl_master.ilike.%${term}%,bl_house.ilike.%${term}%,cliente_nombre.ilike.%${term}%`,
    )
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    embarque_id: r.id,
    expediente: r.expediente,
    cliente_nombre: r.cliente_nombre,
    estado: r.estado,
    etd: r.etd,
    eta: r.eta,
    match_tipo: "Búsqueda manual",
    score: 0,
  }));
}

interface CrearConceptoYVincularInput {
  facturaId: string;
  organizationId: string;
  embarqueId: string;
  proveedorId: string;
  proveedorNombre: string;
  concepto: string;
  monto: number;
  moneda: string;
  folio: string;
  fechaEmision: string;
}

/**
 * Crea un concepto_costo "ad-hoc" en el embarque y registra el vínculo con la
 * factura de proveedor en UNA sola transacción (RPC
 * `crear_concepto_costo_y_vincular_atomico`). Marca el concepto como Pagado
 * de una vez porque el monto fue capturado contra la factura completa (no es
 * presupuesto previo). `clientRequestId` es opcional: si se repite la
 * llamada con el mismo valor, la RPC devuelve el registro ya creado en vez
 * de duplicarlo o fallar (defecto 5: costo + vínculo no eran atómicos).
 */
export async function crearConceptoCostoYVincular(
  input: CrearConceptoYVincularInput & { clientRequestId?: string },
): Promise<{ conceptoId: string }> {
  const { data, error } = await supabase.rpc("crear_concepto_costo_y_vincular_atomico", {
    p_factura_id: input.facturaId,
    p_embarque_id: input.embarqueId,
    p_proveedor_id: input.proveedorId,
    p_proveedor_nombre: input.proveedorNombre,
    p_concepto: input.concepto,
    p_monto: input.monto,
    p_moneda: input.moneda as Moneda,
    p_folio: input.folio,
    p_fecha_emision: input.fechaEmision,
    p_client_request_id: input.clientRequestId,
  });
  if (error) throw error;

  const resultado = data as { concepto_id: string; pfc_id: string | null; reintento: boolean };

  await registrarActividad({
    modulo: "cxp",
    accion: "vincular_embarque_sugerido",
    entidadId: input.facturaId,
    detalles: {
      embarqueId: input.embarqueId,
      conceptoId: resultado.concepto_id,
      monto: input.monto,
      reintento: resultado.reintento,
    },
  });

  return { conceptoId: resultado.concepto_id };
}
