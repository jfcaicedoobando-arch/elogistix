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
import type { ContenedorBorrador } from '@/features/embarques/types/contenedor';
import { toEmbarqueBloqueadoError } from "./embarqueBloqueadoError";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";
export { EmbarqueBloqueadoError, type MotivosBloqueoEmbarque } from "./embarqueBloqueadoError";

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
  /** M-11: contenedores hijos, insertados en la MISMA transacción del alta. */
  contenedores?: ContenedorBorrador[];
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
      p_contenedores: toDbJson(input.contenedores ?? []),
    }),
  );
  rpcIdSchema.parse(data); // valida en runtime; lanza ZodError si shape inválido
  const resultado = fromDb<{ id: string }>(data);
  await registrarBitacoraEmbarque({
    accion: "Creó embarque",
    entidadId: resultado.id,
    entidadNombre: input.embarque.expediente ?? undefined,
    detalles: { modo: input.embarque.modo, tipo: input.embarque.tipo },
  });
  return resultado;
}

export interface ActualizarEmbarqueRpcInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  /** Idempotency key (A.3): si llega el mismo id dos veces, no se reescriben los conceptos. */
  requestId?: string;
  /**
   * FIX-15 · Bloqueo optimista: timestamp `updated_at` que el cliente leyó al
   * abrir el wizard. Si al momento del guardado la fila ya cambió en BD, la
   * RPC devuelve `LC_CONFLICTO_CONCURRENCIA` para que la UI pida recargar.
   */
  expectedUpdatedAt?: string | null;
}

export async function actualizarEmbarqueRpc(input: ActualizarEmbarqueRpcInput): Promise<void> {
  // Defensa en profundidad: el operador y el correo del creador son inmutables
  // una vez establecidos (también hay trigger en BD). Los removemos del payload
  // para que ediciones posteriores nunca intenten sobrescribirlos.
  const { operador: _op, created_by_email: _cbe, created_by: _cb, ...embarqueSinCreador } = input.embarque;
  void _op; void _cbe; void _cb;
  await run(
    // SAFE-CAST: la firma de 6 args con p_expected_updated_at aún no está
    // regenerada en `types.ts`; el schema real en BD la acepta.
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)('actualizar_embarque_completo', {
      p_embarque_id: input.id,
      p_embarque: toDbJson(embarqueSinCreador),
      p_conceptos_venta: toDbJson(input.conceptosVenta),
      p_conceptos_costo: toDbJson(input.conceptosCosto),
      p_request_id: input.requestId,
      p_expected_updated_at: input.expectedUpdatedAt ?? null,
    }),
  );
  await registrarBitacoraEmbarque({
    accion: "editar_embarque",
    entidadId: input.id,
    entidadNombre: embarqueSinCreador.expediente ?? undefined,
  });
}
// RPCs de estado (avanzar / reabrir) viven en `embarqueEstadoRpc.ts` desde
// v13.336.3 (límite Power-of-10 de 200 líneas). Se re-exportan aquí.
export {
  avanzarEstadoEmbarqueRpc,
  reabrirEmbarqueRpc,
} from "./embarqueEstadoRpc";




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
  const resultado = fromDb<{ id: string; expediente: string }[]>(data);
  await registrarBitacoraEmbarque({
    accion: "Duplicó embarque",
    entidadId: embarqueOrigenId,
    entidadNombre: resultado.map((r) => r.expediente).join(", "),
    detalles: { embarqueOrigenId, copias: copias.length, expedientesNuevos: resultado.map((r) => r.expediente) },
  });
  return resultado;
}

export async function eliminarEmbarqueRpc(embarqueId: string): Promise<void> {
  try {
    await run(
      Sentry.startSpan(
        { name: "rpc.eliminar_embarque_completo", op: "db.rpc", attributes: { embarque_id: embarqueId } },
        () => supabase.rpc('eliminar_embarque_completo', { p_embarque_id: embarqueId }),
      ),
    );
  } catch (err) {
    // v13.301.74 (Fase E): la RPC ahora usa RAISE EXCEPTION con marcador
    // `LC_EMBARQUE_BLOQUEADO` + JSON de motivos en el HINT cuando el
    // embarque tiene facturas vivas, CxP, pagos, NCs, comisiones
    // definitivas o está cerrado. Convertimos ese error a un tipo propio
    // para que la UI pueda abrir el dialog de bloqueo con desglose real.
    const bloqueado = toEmbarqueBloqueadoError(err);
    if (bloqueado) throw bloqueado;
    throw err;
  }
  await registrarBitacoraEmbarque({
    accion: "eliminar_embarque",
    entidadId: embarqueId,
  });
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
  actualizarTipoCambioUsdEmbarque,
} from "./embarqueDirectMutations";
