/**
 * Upload idempotente de documentos de embarque. Extraído de
 * `services/documentos.ts` para mantenerlo bajo 200 líneas (Power-of-10).
 *
 * El path incluye el hash del contenido y el registro de `documentos_embarque`
 * sólo se actualiza si cambia. Reintentos con el mismo archivo no duplican
 * ni reescriben filas. Reporta al log de idempotencia (vista /idempotencia)
 * con `fn='upload_documento_embarque'`.
 */
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/services/storage/index';
import { sanitizeFileName, sanitizeStorageKey } from '@/lib/storage';
import type { TablesInsert } from '@/integrations/supabase/types';
import {
  idempotencyClaimSchema,
  isCachedClaim,
} from '@/features/embarques/services/idempotencyClaimSchema';
import { sha256Hex, hexToUuid } from '@/features/embarques/services/documentos/idempotencyHash';
import { registrarActividad } from '@/services/bitacora/registrar';
import {
  limpiarBlobBestEffort,
  limpiarBlobAnteriorTrasReemplazo,
} from '@/lib/documentoStorage';

type DocumentoEstado = TablesInsert<'documentos_embarque'>['estado'];

export interface UploadDocumentoResult {
  path: string;
  fileName: string;
  /** true si el archivo ya estaba registrado con el mismo contenido (no-op). */
  cached: boolean;
}

async function buildScopedRequestId(embarqueId: string, docId: string, hash: string): Promise<string> {
  // La clave DEBE incluir embarqueId+docId+hash; si sólo dependiera del hash,
  // subir el mismo archivo a otro slot devolvería la respuesta cacheada del
  // docId anterior y nunca actualizaríamos la fila correcta (bug 8.220.0).
  const scopedHashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${embarqueId}:${docId}:${hash}`),
  );
  const scopedHex = Array.from(new Uint8Array(scopedHashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hexToUuid(scopedHex);
}

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

  // 2) Reclamar idempotencia.
  const requestId = await buildScopedRequestId(embarqueId, docId, hash);
  const { data: claim } = await supabase.rpc('idempotency_claim', {
    _key: requestId,
    _fn: 'upload_documento_embarque',
  });
  const parsedClaim = idempotencyClaimSchema.safeParse(claim);
  if (parsedClaim.success && isCachedClaim(parsedClaim.data)) {
    const c = parsedClaim.data;
    // Ciclo A→B→A (bug reportado): el claim cacheado puede quedar apuntando a
    // un `path` distinto del que ya trae la fila (p.ej. tras un rollback
    // manual del `archivo`). Si difieren, sincronizamos la fila antes de
    // devolver `cached: true`, para no dejarla desalineada silenciosamente.
    if (c.path !== actual?.archivo) {
      const { data: resynced, error: errResync } = await supabase
        .from('documentos_embarque')
        .update({ archivo: c.path, estado: 'Recibido' as DocumentoEstado })
        .eq('id', docId)
        .select('id');
      if (errResync) throw errResync;
      if (!resynced || resynced.length === 0) {
        throw new Error('No se pudo sincronizar el documento con la respuesta cacheada (sin permisos o el documento ya no existe).');
      }
    }
    return { path: c.path, fileName: c.fileName ?? file.name, cached: true };
  }

  // 3) Upload y update de la fila. .select() detecta UPDATE de 0 filas (RLS,
  //    docId borrado, etc.) y fallamos explícitamente en vez de éxito silencioso.
  await uploadFile(path, file);
  const anterior = actual?.archivo ?? null;
  const { data: updated, error } = await supabase
    .from('documentos_embarque')
    .update({ archivo: path, estado: 'Recibido' as DocumentoEstado })
    .eq('id', docId)
    .select('id');
  // v13.823.47 — si el blob ya subió pero el commit falla (error o 0 filas),
  // el archivo nuevo quedaría huérfano en storage. Se limpia best-effort y se
  // relanza el error ORIGINAL, sin enmascararlo.
  if (error) {
    await limpiarBlobBestEffort(path, 'upload_documento_embarque:commit_fallido');
    throw error;
  }
  if (!updated || updated.length === 0) {
    await limpiarBlobBestEffort(path, 'upload_documento_embarque:cero_filas');
    throw new Error('No se pudo actualizar el documento (sin permisos o el documento ya no existe).');
  }

  // v13.823.47 — reemplazo documental: con el UPDATE ya confirmado, el blob
  // anterior queda huérfano. Se borra best-effort y sólo si difiere del nuevo.
  if (anterior) {
    await limpiarBlobAnteriorTrasReemplazo(anterior, path, 'upload_documento_embarque:reemplazo');
  }

  // v13.823.47 — el commit del documento YA determinó el éxito: la
  // idempotencia y la bitácora post-commit son best-effort y observables. Antes
  // un fallo aquí mostraba error de una operación ya aplicada.
  try {
    await supabase.rpc('idempotency_store', {
      _key: requestId,
      _response: { path, fileName: file.name } as never,
    });
  } catch (e) {
    console.warn('[uploadDocumentoEmbarque] no se pudo guardar la respuesta de idempotencia', e);
  }
  try {
    await registrarActividad({
      modulo: 'documentos',
      accion: 'subir_documento_embarque',
      entidadId: docId,
      entidadNombre: file.name,
      detalles: { embarqueId },
    });
  } catch (e) {
    console.warn('[uploadDocumentoEmbarque] no se pudo registrar la bitácora del documento', e);
  }
  return { path, fileName: file.name, cached: false };
}
