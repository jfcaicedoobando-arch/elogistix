import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  crearFacturaProveedor,
  softDeleteFacturaProveedor,
  actualizarFacturaProveedor,
  SaldoNegativoError,
  type ActualizarFacturaPayload,
  type NuevaFacturaProveedorPayload,
} from "@/features/cxp/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function useCrearFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: NuevaFacturaProveedorPayload) => crearFacturaProveedor(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      // Ola 12 · R3P-02: conciliación/estado de cuenta del proveedor.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      // El toast de éxito lo emite `useNuevaFacturaProveedorForm.submit` al
      // terminar todo el flujo (insert + storage + vínculos), para evitar el
      // doble toast reportado en 13.218.1 (Karol, captura de factura).
    },
    // v13.303.85 — NO emitir toast en onError: `runSubmit` ya llama a
    // `handleSubmitError`, que traduce el `23505 uuid_fiscal` a un mensaje
    // amigable ("CFDI duplicado"). Un toast aquí generaba doble notificación.
  });
}

export function useEliminarFacturaProveedor() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => softDeleteFacturaProveedor(id, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      // Ola 12 · R3P-02: conciliación/estado de cuenta del proveedor.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Factura de proveedor eliminada" });
    },
    onError: (error: Error) => {
      // La fila pudo quedar "fantasma" en un cliente con caché viejo: la BD
      // responde LC_FACTURA_PROVEEDOR_NOT_FOUND porque ya estaba borrada.
      if (/LC_FACTURA_PROVEEDOR_NOT_FOUND/.test(error.message)) {
        qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      // Ola 12 · R3P-02: conciliación/estado de cuenta del proveedor.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
        notifyError(undefined, {
          title: "Esta factura ya había sido eliminada. Actualizamos la lista.",
          error,
          method: "DELETE_FACTURA_PROVEEDOR_NOT_FOUND",
        });
        return;
      }
      notifyError(undefined, { title: "No se pudo eliminar factura proveedor", description: getErrorMessage(error), error, method: "DELETE_FACTURA_PROVEEDOR" });
    },
  });
}

export function useActualizarFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, expectedUpdatedAt }: {
      id: string;
      payload: ActualizarFacturaPayload;
      /** H5 (Ola 4): `updated_at` leído al abrir el modal (bloqueo optimista). */
      expectedUpdatedAt?: string | null;
    }) => actualizarFacturaProveedor(id, payload, expectedUpdatedAt),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      // Ola 12 · R3P-02: conciliación/estado de cuenta del proveedor.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.factura(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.historial(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
      notifySuccess(undefined, { title: "Factura de proveedor actualizada" });
    },
    onError: (error: Error) => {
      const code = (error as Error & { code?: string }).code;
      if (error instanceof SaldoNegativoError || code === "SALDO_NEGATIVO") {
        notifyError(undefined, { title: "El nuevo total no puede ser menor a lo ya pagado", error, method: "UPDATE_FACTURA_PROVEEDOR_SALDO" });
        return;
      }
      if (code === "DUPLICADO") {
        notifyError(undefined, { title: "Folio duplicado para este proveedor y fecha", error, method: "UPDATE_FACTURA_PROVEEDOR_DUP" });
        return;
      }
      notifyError(undefined, { title: "No se pudo actualizar factura", description: getErrorMessage(error), error, method: "UPDATE_FACTURA_PROVEEDOR" });
    },
  });
}
