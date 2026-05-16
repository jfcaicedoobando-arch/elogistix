import { supabase } from '@/integrations/supabase/client';
import { uploadFile, deleteFile } from '@/services/storage/index';
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

export async function uploadDocumentoEmbarque(
  embarqueId: string,
  docId: string,
  file: File,
): Promise<{ path: string; fileName: string }> {
  const path = `embarques/${sanitizeStorageKey(embarqueId)}/${sanitizeStorageKey(docId)}/${sanitizeFileName(file.name)}`;
  await uploadFile(path, file);
  const { error } = await supabase
    .from('documentos_embarque')
    .update({ archivo: path, estado: 'Recibido' as DocumentoEstado })
    .eq('id', docId);
  if (error) throw error;
  return { path, fileName: file.name };
}

export async function deleteDocumentoEmbarque(docId: string, archivoPath: string): Promise<void> {
  // Soft delete (A.2.2): mantenemos el archivo en storage por si se restaura desde papelera.
  const { error } = await supabase.rpc('soft_delete_record', {
    _table: 'documentos_embarque',
    _id: docId,
  });
  if (error) throw error;
}
