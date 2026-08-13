/**
 * Ola 4 — Expediente documental del cliente: lectura + subida + borrado.
 * Espejo de `useProveedorDocumentos` para que ambas fichas se sientan iguales.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  fetchClienteDocumentos,
  subirDocumentoCliente,
  eliminarDocumentoCliente,
  type SubirDocumentoClienteInput,
} from "@/features/cliente/services/clienteDocumentos";
import { clientes } from "@/features/cliente/queryKeys";

function mensajeError(e: unknown, fallback: string): string {
  const msg = (e as { message?: string } | null)?.message;
  return msg && msg.trim().length > 0 ? msg : fallback;
}

const claveDocumentos = (clienteId: string) => clientes.documentos(clienteId);

export function useClienteDocumentos(clienteId: string | undefined) {
  return useQuery({
    queryKey: claveDocumentos(clienteId ?? ""),
    queryFn: () => fetchClienteDocumentos(clienteId!),
    enabled: Boolean(clienteId),
    staleTime: 60_000,
  });
}

export function useSubirDocumentoCliente(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubirDocumentoClienteInput) => subirDocumentoCliente(input),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Documento agregado al expediente" });
      void qc.invalidateQueries({ queryKey: claveDocumentos(clienteId) });
    },
    onError: (e: unknown) =>
      notifyError(undefined, {
        title: "No se pudo subir el documento",
        description: mensajeError(e, "Intenta de nuevo o revisa el formato del archivo."),
        error: e,
        method: "UPLOAD_CLIENTE_DOCUMENTO",
      }),
  });
}

export function useEliminarDocumentoCliente(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: { id: string; archivo: string }) => eliminarDocumentoCliente(doc),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Documento eliminado del expediente" });
      void qc.invalidateQueries({ queryKey: claveDocumentos(clienteId) });
    },
    onError: (e: unknown) =>
      notifyError(undefined, {
        title: "No se pudo eliminar el documento",
        description: mensajeError(e, "Intenta de nuevo en unos segundos."),
        error: e,
        method: "DELETE_CLIENTE_DOCUMENTO",
      }),
  });
}
