/**
 * Ola 4 — Contactos del proveedor: lectura + alta + edición + baja lógica.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  fetchProveedorContactos,
  crearContactoProveedor,
  actualizarContactoProveedor,
  eliminarContactoProveedor,
} from "@/features/proveedor/services/contactosProveedor";
import type { ContactoProveedorForm } from "@/features/proveedor/domain/contactosProveedor";
import { proveedores } from "@/features/proveedor/queryKeys";

function mensajeError(e: unknown, fallback: string): string {
  const msg = (e as { message?: string } | null)?.message;
  return msg && msg.trim().length > 0 ? msg : fallback;
}

const clave = (proveedorId: string) => proveedores.contactos(proveedorId);

export function useProveedorContactos(proveedorId: string | undefined) {
  return useQuery({
    queryKey: clave(proveedorId ?? ""),
    queryFn: () => fetchProveedorContactos(proveedorId!),
    enabled: Boolean(proveedorId),
    staleTime: 60_000,
  });
}

export function useGuardarContactoProveedor(
  proveedorId: string,
  organizationId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      form: ContactoProveedorForm;
      expectedUpdatedAt?: string | null;
    }) =>
      input.id
        ? actualizarContactoProveedor({
            id: input.id,
            form: input.form,
            expectedUpdatedAt: input.expectedUpdatedAt,
          })
        : crearContactoProveedor({ proveedorId, organizationId, form: input.form }).then(
            () => undefined,
          ),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Contacto guardado" });
      void qc.invalidateQueries({ queryKey: clave(proveedorId) });
    },
    onError: (e: unknown) =>
      notifyError(undefined, {
        title: "No se pudo guardar el contacto",
        description: mensajeError(e, "Revisa los datos capturados e intenta de nuevo."),
        error: e,
        method: "SAVE_PROVEEDOR_CONTACTO",
      }),
  });
}

export function useEliminarContactoProveedor(proveedorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarContactoProveedor(id),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Contacto eliminado" });
      void qc.invalidateQueries({ queryKey: clave(proveedorId) });
    },
    onError: (e: unknown) =>
      notifyError(undefined, {
        title: "No se pudo eliminar el contacto",
        description: mensajeError(e, "Intenta de nuevo en unos segundos."),
        error: e,
        method: "DELETE_PROVEEDOR_CONTACTO",
      }),
  });
}
