/**
 * Ola 3 — Acceso a datos del expediente documental del proveedor.
 * Los archivos viven en el bucket privado `documentos`, bajo
 * `proveedores/{proveedor_id}/...`; la tabla `proveedor_documentos` guarda los
 * metadatos (tipo, vigencia, notas) con RLS por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { uploadFile, getSignedUrl, deleteFile } from "@/services/storage";
import type {
  DocumentoProveedor,
  TipoDocumentoProveedor,
} from "@/features/proveedor/domain/documentosProveedor";

const SELECT =
  "id, proveedor_id, tipo, nombre, archivo, mime_type, tamano_bytes, fecha_documento, fecha_vencimiento, notas, created_at" as const;

export async function fetchProveedorDocumentos(
  proveedorId: string,
): Promise<DocumentoProveedor[]> {
  const filas = await unwrapOr(
    supabase
      .from("proveedor_documentos")
      .select(SELECT)
      .eq("proveedor_id", proveedorId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    [],
  );
  return (filas ?? []) as DocumentoProveedor[];
}

/** Limpia el nombre del archivo para que sea seguro como llave de storage. */
export function slugArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export interface SubirDocumentoInput {
  proveedorId: string;
  organizationId: string;
  tipo: TipoDocumentoProveedor;
  archivo: File;
  fechaDocumento?: string | null;
  fechaVencimiento?: string | null;
  notas?: string | null;
}

export async function subirDocumentoProveedor(
  input: SubirDocumentoInput,
): Promise<DocumentoProveedor> {
  const path = `proveedores/${input.proveedorId}/${Date.now()}-${slugArchivo(input.archivo.name)}`;
  await uploadFile(path, input.archivo, { contentType: input.archivo.type || undefined });

  try {
    const { data: sesion } = await supabase.auth.getUser();
    const fila = await unwrap(
      supabase
        .from("proveedor_documentos")
        .insert({
          organization_id: input.organizationId,
          proveedor_id: input.proveedorId,
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
    return fila as DocumentoProveedor;
  } catch (e) {
    // Si falla el registro, no dejamos el archivo huérfano en el almacenamiento.
    await deleteFile(path).catch(() => undefined);
    throw e;
  }
}

export async function urlDocumentoProveedor(archivo: string): Promise<string> {
  return getSignedUrl(archivo, 300);
}

export async function eliminarDocumentoProveedor(doc: {
  id: string;
  archivo: string;
}): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  await run(
    supabase
      .from("proveedor_documentos")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: sesion.user?.id ?? null,
      })
      .eq("id", doc.id),
  );
  await deleteFile(doc.archivo).catch(() => undefined);
}
