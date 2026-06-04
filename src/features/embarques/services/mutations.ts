import { z } from "zod";
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { fromDb, toDbJson } from "@/lib/supabase/cast";
import {
  embarqueInsertSchema,
  notaSchema,
  parseOrThrow,
} from "@/lib/validation/mutationSchemas";

// Schemas para validar los payloads de retorno de las RPCs.
// Si la RPC cambia de shape o devuelve null inesperado, fallamos rápido y
// fuerte en el boundary, en vez de propagar `undefined.id` aguas abajo.
// Nota: con `strictNullChecks` apagado, `z.infer` marca los campos como
// opcionales aunque Zod los valide como requeridos. Por eso re-tipamos en
// el call site con `fromDb<T>` (segunda sobrecarga sin schema) tras validar.
const rpcIdSchema = z.object({ id: z.string().uuid() });
const rpcIdExpedienteArraySchema = z.array(
  z.object({ id: z.string().uuid(), expediente: z.string() }),
);

type EmbarqueInsert = TablesInsert<'embarques'>;

export interface CrearEmbarqueRpcInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
  /** Idempotency key (A.3): si llega el mismo id dos veces, no se duplica. */
  requestId?: string;
}

export async function crearEmbarqueRpc(input: CrearEmbarqueRpcInput): Promise<{ id: string }> {
  parseOrThrow(embarqueInsertSchema, input.embarque, "Embarque");
  const { data, error } = await supabase.rpc('crear_embarque_completo', {
    p_embarque: toDbJson(input.embarque),
    p_conceptos_venta: toDbJson(input.conceptosVenta),
    p_conceptos_costo: toDbJson(input.conceptosCosto),
    p_documentos: toDbJson(input.documentos),
    p_request_id: input.requestId,
  });
  if (error) throw error;
  rpcIdSchema.parse(data); // valida en runtime; lanza ZodError si shape inválido
  return fromDb<{ id: string }>(data);
}

export interface ActualizarEmbarqueRpcInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  /** Idempotency key (A.3): si llega el mismo id dos veces, no se reescriben los conceptos. */
  requestId?: string;
}

export async function actualizarEmbarqueRpc(input: ActualizarEmbarqueRpcInput): Promise<void> {
  const { error } = await supabase.rpc('actualizar_embarque_completo', {
    p_embarque_id: input.id,
    p_embarque: toDbJson(input.embarque),
    p_conceptos_venta: toDbJson(input.conceptosVenta),
    p_conceptos_costo: toDbJson(input.conceptosCosto),
    p_request_id: input.requestId,
  });
  if (error) throw error;
}

export interface AvanzarEstadoEmbarqueInput {
  embarqueId: string;
  nuevoEstado: string;
  usuarioEmail: string;
  tipoEvento: string;
  descripcionEvento: string;
  requestId?: string;
}

export async function avanzarEstadoEmbarqueRpc(input: AvanzarEstadoEmbarqueInput): Promise<void> {
  const { error } = await supabase.rpc('avanzar_estado_embarque', {
    p_embarque_id: input.embarqueId,
    p_nuevo_estado: input.nuevoEstado,
    p_usuario_email: input.usuarioEmail,
    p_tipo_evento: input.tipoEvento,
    p_descripcion_evento: input.descripcionEvento,
    p_request_id: input.requestId,
  });
  if (error) throw error;
}

export interface ReabrirEmbarqueInput {
  embarqueId: string;
  usuarioEmail: string;
  requestId?: string;
}

/**
 * Reabre un embarque cerrado (estado Cerrado → Entregado). Solo admin/super_admin
 * pueden ejecutarla; el backend valida rol y estado actual.
 */
export async function reabrirEmbarqueRpc(input: ReabrirEmbarqueInput): Promise<void> {
  // SAFE-CAST: la RPC nueva aún no aparece en el types.ts regenerado; suprimimos el cast.
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>)('reabrir_embarque', {
    p_embarque_id: input.embarqueId,
    p_usuario_email: input.usuarioEmail,
    p_request_id: input.requestId,
  });
  if (error) throw error as Error;
}

export async function duplicarEmbarqueRpc(
  embarqueOrigenId: string,
  copias: Array<{
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }>,
  requestId?: string,
): Promise<{ id: string; expediente: string }[]> {
  const { data, error } = await supabase.rpc('duplicar_embarque_completo', {
    p_embarque_origen_id: embarqueOrigenId,
    p_copias: toDbJson(copias),
    p_request_id: requestId,
  });
  if (error) throw error;
  rpcIdExpedienteArraySchema.parse(data); // valida shape; lanza ZodError si inválido
  return fromDb<{ id: string; expediente: string }[]>(data);
}

export async function eliminarEmbarqueRpc(embarqueId: string): Promise<void> {
  const { error } = await supabase.rpc('eliminar_embarque_completo', {
    p_embarque_id: embarqueId,
  });
  if (error) throw error;
}

export async function actualizarEstadoEmbarque(embarqueId: string, estado: string): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({ estado: estado as EmbarqueInsert['estado'] })
    .eq('id', embarqueId);
  if (error) throw error;
}

/**
 * Actualiza la fecha de llegada real del embarque. Usada por el form de
 * tracking cuando se registra un evento de "Arribo a Puerto" o "Entrega"
 * y el operador confirma sincronizar la fecha visible en el resto del
 * sistema. RLS de la tabla aplica tenancy automáticamente.
 */
export async function actualizarFechaLlegadaRealEmbarque(
  embarqueId: string,
  fechaIso: string,
): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({ fecha_llegada_real: fechaIso })
    .eq('id', embarqueId);
  if (error) throw error;
}



export async function insertarNotaEmbarque(
  embarqueId: string,
  contenido: string,
  usuario: string,
): Promise<void> {
  parseOrThrow(notaSchema, { contenido, usuario }, "Nota");
  const { error } = await supabase.from('notas_embarque').insert({
    embarque_id: embarqueId,
    contenido,
    tipo: 'nota' as const,
    usuario,
  });
  if (error) throw error;
}
