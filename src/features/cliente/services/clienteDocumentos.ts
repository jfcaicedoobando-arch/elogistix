/**
 * Ola 4 — Acceso a datos del expediente documental del cliente.
 * Espejo del servicio de proveedor: los archivos viven en el bucket privado
 * `documentos` bajo `clientes/{cliente_id}/...` y la tabla
 * `cliente_documentos` guarda los metadatos con RLS por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { uploadFile, getSignedUrl } from "@/services/storage";
import { limpiarBlobBestEffort } from "@/lib/documentoStorage";
import { logClientError } from "@/services/observability/logClientError";
import { registrarActividad } from "@/services/bitacora/registrar";
import { slugArchivo } from "@/features/expediente/domain/expediente";
import type {
  DocumentoCliente,
  TipoDocumentoCliente,
} from "@/features/cliente/domain/documentosCliente";

const SELECT =
  "id, cliente_id, tipo, nombre, archivo, mime_type, tamano_bytes, fecha_documento, fecha_vencimiento, notas, created_at" as const;

export async function fetchClienteDocumentos(
  clienteId: string,
): Promise<DocumentoCliente[]> {
  const filas = await unwrapOr(
    supabase
      .from("cliente_documentos")
      .select(SELECT)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    [],
  );
  return (filas ?? []) as DocumentoCliente[];
}

export interface SubirDocumentoClienteInput {
  clienteId: string;
  organizationId: string;
  tipo: TipoDocumentoCliente;
  archivo: File;
  fechaDocumento?: string | null;
  fechaVencimiento?: string | null;
  notas?: string | null;
}

export async function subirDocumentoCliente(
  input: SubirDocumentoClienteInput,
): Promise<DocumentoCliente> {
  const path = `clientes/${input.clienteId}/${Date.now()}-${slugArchivo(input.archivo.name)}`;
  await uploadFile(path, input.archivo, { contentType: input.archivo.type || undefined });

  try {
    const { data: sesion } = await supabase.auth.getUser();
    const fila = await unwrap(
      supabase
        .from("cliente_documentos")
        .insert({
          organization_id: input.organizationId,
          cliente_id: input.clienteId,
          tipo: input.tipo,
          nombre: input.archivo.name,
          archivo: path,
          mime_type: input.archivo.type || null,
          tamano_bytes: input.archivo.size ?? null,
          fecha_documento: input.fechaDocumento || null,
          fecha_vencimiento: input.fechaVencimiento || null,
          notas: input.notas?.trim() || null,
          uploaded_by: sesion.user?.id ?? null,
        })
        .select(SELECT)
        .single(),
    );
    return fila as DocumentoCliente;
  } catch (e) {
    // Si falla el registro, no dejamos el archivo huérfano en el almacenamiento.
    // Best-effort: se limpia el blob nuevo y se relanza el error original sin enmascararlo.
    await limpiarBlobBestEffort(path, "subirDocumentoCliente");
    throw e;
  }
}

export async function urlDocumentoCliente(archivo: string): Promise<string> {
  return getSignedUrl(archivo, 300);
}

export async function eliminarDocumentoCliente(doc: {
  id: string;
  archivo: string;
}): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  // El commit del borrado lógico determina el éxito de la operación: una vez
  // confirmado, la limpieza del blob y la bitácora son best-effort y no deben
  // reportarse como error ni revertir la referencia ya guardada.
  await run(
    supabase
      .from("cliente_documentos")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: sesion.user?.id ?? null,
      })
      .eq("id", doc.id),
  );

  // La limpieza del blob se ejecuta aunque falle la bitácora posterior.
  await limpiarBlobBestEffort(doc.archivo, `eliminarDocumentoCliente(${doc.id})`);

  try {
    await registrarActividad({
      modulo: "clientes",
      accion: "eliminar_documento_cliente",
      entidadId: doc.id,
      entidadNombre: doc.archivo,
    });
  } catch (e) {
    logClientError({
      message: `Expediente cliente: fallo la bitácora al eliminar el documento ${doc.id}.`,
    });
    console.warn(`[clienteDocumentos] fallo la bitácora al eliminar doc ${doc.id}`, e);
  }
}
