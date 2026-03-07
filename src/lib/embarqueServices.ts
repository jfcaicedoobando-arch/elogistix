import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';

/**
 * Resuelve o genera un número de expediente para un nuevo embarque.
 * Si se proporciona un BL Master existente, reutiliza el expediente asociado;
 * de lo contrario, genera uno nuevo con el consecutivo correspondiente.
 */
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

/**
 * Sube documentos al bucket de storage en paralelo.
 * Retorna el payload con nombre + ruta del archivo para cada documento.
 */
export async function subirDocumentosEmbarque(
  expediente: string,
  documentosChecklist: { nombre: string }[],
  archivos: Record<string, File>,
): Promise<{ nombre: string; archivo?: string }[]> {
  const tareas = documentosChecklist.map(async (doc) => {
    const file = archivos[doc.nombre];
    if (file) {
      const ruta = `embarques/${expediente}/${doc.nombre}/${Date.now()}_${file.name}`;
      await uploadFile(ruta, file);
      return { nombre: doc.nombre, archivo: ruta };
    }
    return { nombre: doc.nombre };
  });

  return Promise.all(tareas);
}
