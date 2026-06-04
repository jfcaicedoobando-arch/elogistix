import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/services/storage/index';
import {
  buildEmbarqueDocPath,
  sanitizeFileName,
  sanitizeStorageKey,
} from '@/lib/storage';
import type { TablesInsert } from '@/integrations/supabase/types';
import {
  idempotencyClaimSchema,
  isCachedClaim,
} from '@/features/embarques/services/idempotencyClaimSchema';
import { sha256Hex, hexToUuid } from '@/features/embarques/services/documentos/idempotencyHash';

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

  // 2) Reclamar idempotencia. La clave DEBE incluir embarqueId+docId+hash; si
  //    sólo dependiera del hash, subir el mismo archivo a otro slot devolvería
  //    la respuesta cacheada del docId anterior y nunca actualizaríamos la
  //    fila correcta (bug detectado en 8.220.0).
  const scopedHashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${embarqueId}:${docId}:${hash}`),
  );
  const scopedHex = Array.from(new Uint8Array(scopedHashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const requestId = hexToUuid(scopedHex);
  const { data: claim } = await supabase.rpc('idempotency_claim', {
    _key: requestId,
    _fn: 'upload_documento_embarque',
  });
  const parsedClaim = idempotencyClaimSchema.safeParse(claim);
  if (parsedClaim.success && isCachedClaim(parsedClaim.data)) {
    const c = parsedClaim.data;
    return { path: c.path, fileName: c.fileName ?? file.name, cached: true };
  }

  // 3) Upload y update de la fila. Usamos .select() para detectar si el UPDATE
  //    afectó 0 filas (RLS, docId borrado, etc.) y fallar explícitamente en
  //    vez de devolver éxito silencioso con el toast verde.
  await uploadFile(path, file);
  const { data: updated, error } = await supabase
    .from('documentos_embarque')
    .update({ archivo: path, estado: 'Recibido' as DocumentoEstado })
    .eq('id', docId)
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('No se pudo actualizar el documento (sin permisos o el documento ya no existe).');
  }

  await supabase.rpc('idempotency_store', {
    _key: requestId,
    _response: { path, fileName: file.name } as never,
  });
  return { path, fileName: file.name, cached: false };
}

export async function deleteDocumentoEmbarque(docId: string, archivoPath?: string): Promise<void> {
  // Desadjuntar: limpiamos el archivo y reseteamos estado a 'Pendiente' para
  // conservar el renglón del checklist y permitir un nuevo upload. La fila no
  // debe eliminarse (soft delete) — sólo se elimina el adjunto en sí.
  const { data: updated, error } = await supabase
    .from('documentos_embarque')
    .update({ archivo: null, estado: 'Pendiente' as DocumentoEstado })
    .eq('id', docId)
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('No se pudo eliminar el adjunto (sin permisos o el documento ya no existe).');
  }

  // Limpieza best-effort del blob en storage: si falla no bloqueamos la UI.
  if (archivoPath) {
    try {
      const { deleteFile } = await import('@/services/storage/index');
      await deleteFile(archivoPath);
    } catch {
      // Ignorado: el objeto puede no existir o ya estar huérfano.
    }
  }
}

export async function createDocumentoEmbarqueRow(params: {
  embarqueId: string;
  nombre: string;
  notas?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("documentos_embarque")
    .insert({
      embarque_id: params.embarqueId,
      nombre: params.nombre,
      estado: "Pendiente",
      notas: params.notas ?? null,
    });
  if (error) throw error;
}

/**
 * Marca un documento como "No aplica" (o lo revierte a "Pendiente").
 * Sólo permitido cuando no hay archivo adjunto. No se permite marcar como
 * "No aplica" un documento obligatorio (ej. "BL Master") — esa validación
 * vive en la UI; el servicio sólo aplica la mutación.
 */
export async function setDocumentoEstadoNoAplica(
  docId: string,
  noAplica: boolean,
): Promise<void> {
  const nuevoEstado: DocumentoEstado = noAplica ? 'No aplica' : 'Pendiente';
  const { data: updated, error } = await supabase
    .from('documentos_embarque')
    .update({ estado: nuevoEstado, archivo: null })
    .eq('id', docId)
    .is('archivo', null)
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('No se pudo actualizar el documento (verifica que no tenga archivo adjunto).');
  }
}
