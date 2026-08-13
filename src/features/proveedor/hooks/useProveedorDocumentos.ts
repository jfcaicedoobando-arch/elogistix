/**
 * Ola 3 — Expediente documental del proveedor: lectura + subida + borrado.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchProveedorDocumentos,
  subirDocumentoProveedor,
  eliminarDocumentoProveedor,
  type SubirDocumentoInput,
} from "@/features/proveedor/services/proveedorDocumentos";
import { proveedores } from "@/features/proveedor/queryKeys";

function mensajeError(e: unknown, fallback: string): string {
  const msg = (e as { message?: string } | null)?.message;
  return msg && msg.trim().length > 0 ? msg : fallback;
}

/** Clave única del catálogo central: evita invalidaciones que no pegan. */
const claveDocumentos = (proveedorId: string) => proveedores.documentos(proveedorId);

export function useProveedorDocumentos(proveedorId: string | undefined) {
  return useQuery({
    queryKey: claveDocumentos(proveedorId ?? ""),
    queryFn: () => fetchProveedorDocumentos(proveedorId!),
    enabled: Boolean(proveedorId),
    staleTime: 60_000,
  });
}

export function useSubirDocumentoProveedor(proveedorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubirDocumentoInput) => subirDocumentoProveedor(input),
    onSuccess: () => {
      toast.success("Documento agregado al expediente");
      void qc.invalidateQueries({ queryKey: claveDocumentos(proveedorId) });
    },
    onError: (e: unknown) => toast.error(mensajeError(e, "No se pudo subir el documento")),
  });
}

export function useEliminarDocumentoProveedor(proveedorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: { id: string; archivo: string }) => eliminarDocumentoProveedor(doc),
    onSuccess: () => {
      toast.success("Documento eliminado del expediente");
      void qc.invalidateQueries({ queryKey: claveDocumentos(proveedorId) });
    },
    onError: (e: unknown) => toast.error(mensajeError(e, "No se pudo eliminar el documento")),
  });
}
