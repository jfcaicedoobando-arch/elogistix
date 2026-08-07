import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/services/storage/index';
import { buildEmbarqueDocOrgPath } from '@/services/storage/orgPath';
import { registrarActividad } from '@/services/bitacora/registrar';
import type { TablesInsert } from '@/integrations/supabase/types';


type DocumentoEstado = TablesInsert<'documentos_embarque'>['estado'];

export { uploadDocumentoEmbarque,  } from './documentos/uploadDocumentoEmbarque';

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
    tipo_op: tipoOperacion as 'Cross Trade' | 'Exportación' | 'Importación' | 'Intra USA' | 'Nacional',
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
      // v13.420.0: la ruta arranca con el organization_id para cumplir la RLS
      // del bucket `documentos` (el embarque aún no existe en este punto).
      const ruta = await buildEmbarqueDocOrgPath(expediente, doc.nombre, file.name);
      await uploadFile(ruta, file);
      return { nombre: doc.nombre, archivo: ruta };
    }
    return { nombre: doc.nombre };

  });

  return Promise.all(tareas);
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

  await registrarActividad({
    modulo: 'documentos',
    accion: 'desadjuntar_documento',
    entidadId: docId,
    detalles: { archivo: archivoPath ?? null },
  });

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
  await registrarActividad({
    modulo: 'documentos',
    accion: 'agregar_documento_checklist',
    entidadId: params.embarqueId,
    entidadNombre: params.nombre,
  });
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
