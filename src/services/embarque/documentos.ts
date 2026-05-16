import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/services/storage/index';
import {
  buildEmbarqueDocPath,
  sanitizeFileName,
  sanitizeStorageKey,
} from '@/lib/storage';
import type { TablesInsert } from '@/integrations/supabase/types';

type DocumentoEstado = TablesInsert<'documentos_embarque'>['estado'];

export async function resolverExpediente(
  blMaster: string | undefined | null,
  tipoOperacion: string,
): Promise<string> {
  if (blMaster && blMaster.trim()) {
    const { data, error } = await supabase.rpc('resolver_expediente_por_bl', {
      _bl_master: blMaster.trim(),
      _tipo_op: tipoOperacion,
    });
    if (error || !data) {
      throw new Error(error?.message || 'No se pudo resolver el número de referencia.');
    }
    return data;
  }

  const { data, error } = await supabase.rpc('generar_expediente', {
    tipo_op: tipoOperacion,
  });
  if (error || !data) {
    throw new Error(error?.message || 'No se pudo generar el número de referencia.');
  }
  return data;
}

export async function subirDocumentosEmbarque(
  expediente: string,
  documentosChecklist: { nombre: string }[],
  archivos: Record<string, File>,
): Promise<{ nombre: string; archivo?: string }[]> {
  const tareas = documentosChecklist.map(async (doc) => {
    const file = archivos[doc.nombre];
    if (file) {
      const ruta = buildEmbarqueDocPath(expediente, doc.nombre, file.name);
      await uploadFile(ruta, file);
      return { nombre: doc.nombre, archivo: ruta };
    }
    return { nombre: doc.nombre };
  });

  return Promise.all(tareas);
}

/**
 * SHA-256 del contenido del archivo en hex. Usado como huella estable para
 * idempotencia: dos uploads del mismo File siempre producen el mismo hash.
 */
async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convierte un hex >=32 chars a formato UUID v4-like determinístico. */
function hexToUuid(hex: string): string {
  const h = hex.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export interface UploadDocumentoResult {
  path: string;
  fileName: string;
  /** true si el archivo ya estaba registrado con el mismo contenido (no-op). */
  cached: boolean;
}

/**
 * Upload idempotente: el path incluye el hash del contenido y el registro de
 * documentos_embarque sólo se actualiza si cambia. Reintentos con el mismo
 * archivo no duplican ni reescriben filas. Se reporta al log de idempotencia
 * (vista /idempotencia) con fn='upload_documento_embarque'.
 */
export async function uploadDocumentoEmbarque(
  embarqueId: string,
  docId: string,
  file: File,
): Promise<UploadDocumentoResult> {
  const hash = await sha256Hex(file);
  const path = `embarques/${sanitizeStorageKey(embarqueId)}/${sanitizeStorageKey(docId)}/${hash.slice(0, 12)}-${sanitizeFileName(file.name)}`;

  // 1) Si la fila ya apunta al mismo archivo (mismo contenido), no hacer nada.
  const { data: actual, error: errSel } = await supabase
    .from('documentos_embarque')
    .select('archivo')
    .eq('id', docId)
    .maybeSingle();
  if (errSel) throw errSel;
  if (actual?.archivo === path) {
    return { path, fileName: file.name, cached: true };
  }

  // 2) Reclamar idempotencia (clave determinística por docId+hash) para que
  //    reintentos concurrentes desde otra pestaña queden registrados.
  const requestId = hexToUuid(hash);
  const { data: claim } = await supabase.rpc('idempotency_claim', {
    _key: requestId,
    _fn: 'upload_documento_embarque',
  });
  if (claim && typeof claim === 'object' && !Array.isArray(claim)) {
    const c = claim as Record<string, unknown>;
    if (!c.__idempotency_pending && typeof c.path === 'string') {
      return { path: c.path as string, fileName: (c.fileName as string) ?? file.name, cached: true };
    }
  }

  // 3) Upload (upsert) y update de la fila. Si falla, el siguiente reintento
  //    encontrará el claim pendiente y procederá normalmente.
  await uploadFile(path, file);
  const { error } = await supabase
    .from('documentos_embarque')
    .update({ archivo: path, estado: 'Recibido' as DocumentoEstado })
    .eq('id', docId);
  if (error) throw error;

  await supabase.rpc('idempotency_store', {
    _key: requestId,
    _response: { path, fileName: file.name } as never,
  });
  return { path, fileName: file.name, cached: false };
}

export async function deleteDocumentoEmbarque(docId: string, _archivoPath?: string): Promise<void> {
  // Soft delete (A.2.2): mantenemos el archivo en storage por si se restaura desde papelera.
  const { error } = await supabase.rpc('soft_delete_record', {
    _table: 'documentos_embarque',
    _id: docId,
  });
  if (error) throw error;
}
