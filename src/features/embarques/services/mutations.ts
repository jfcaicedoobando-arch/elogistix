import { z } from "zod";
import * as Sentry from "@sentry/react";
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { fromDb, toDbJson } from "@/lib/supabase/cast";
import { unwrap, run } from "@/lib/supabase/response";
import {
  embarqueInsertSchema,
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
  const data = await unwrap(
    supabase.rpc('crear_embarque_completo', {
      p_embarque: toDbJson(input.embarque),
      p_conceptos_venta: toDbJson(input.conceptosVenta),
      p_conceptos_costo: toDbJson(input.conceptosCosto),
      p_documentos: toDbJson(input.documentos),
      p_request_id: input.requestId,
    }),
  );
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
  // Defensa en profundidad: el operador y el correo del creador son inmutables
  // una vez establecidos (también hay trigger en BD). Los removemos del payload
  // para que ediciones posteriores nunca intenten sobrescribirlos.
  const { operador: _op, created_by_email: _cbe, created_by: _cb, ...embarqueSinCreador } = input.embarque;
  void _op; void _cbe; void _cb;
  await run(
    supabase.rpc('actualizar_embarque_completo', {
      p_embarque_id: input.id,
      p_embarque: toDbJson(embarqueSinCreador),
      p_conceptos_venta: toDbJson(input.conceptosVenta),
      p_conceptos_costo: toDbJson(input.conceptosCosto),
      p_request_id: input.requestId,
    }),
  );
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
  await run(
    supabase.rpc('avanzar_estado_embarque', {
      p_embarque_id: input.embarqueId,
      p_nuevo_estado: input.nuevoEstado,
      p_usuario_email: input.usuarioEmail,
      p_tipo_evento: input.tipoEvento,
      p_descripcion_evento: input.descripcionEvento,
      p_request_id: input.requestId,
    }),
  );
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
  await run(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)('reabrir_embarque', {
      p_embarque_id: input.embarqueId,
      p_usuario_email: input.usuarioEmail,
      p_request_id: input.requestId,
    }),
  );
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
  const data = await unwrap(
    supabase.rpc('duplicar_embarque_completo', {
      p_embarque_origen_id: embarqueOrigenId,
      p_copias: toDbJson(copias),
      p_request_id: requestId,
    }),
  );
  rpcIdExpedienteArraySchema.parse(data); // valida shape; lanza ZodError si inválido
  return fromDb<{ id: string; expediente: string }[]>(data);
}

export async function eliminarEmbarqueRpc(embarqueId: string): Promise<void> {
  await run(
    Sentry.startSpan(
      { name: "rpc.eliminar_embarque_completo", op: "db.rpc", attributes: { embarque_id: embarqueId } },
      () => supabase.rpc('eliminar_embarque_completo', { p_embarque_id: embarqueId }),
    ),
  );
}

// Mutaciones directas (update de columnas + inserción de notas) viven en
// `embarqueDirectMutations.ts` desde v13.214.1 para respetar el límite
// Power-of-10 de 200 líneas por archivo. Se re-exportan aquí para
// mantener compatibilidad con imports existentes.
export {
  actualizarEstadoEmbarque,
  actualizarFechaLlegadaRealEmbarque,
  actualizarEtaEmbarque,
  insertarNotaEmbarque,
} from "./embarqueDirectMutations";
