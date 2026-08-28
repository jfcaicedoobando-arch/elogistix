/** Mutaciones del feature Anticipos a Proveedor — usan `useMutationWithFeedback`. */
import { useRef } from "react";
import { useMutationWithFeedback } from "@/hooks/shared";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";
import { queryKeys } from "@/lib/query";
import {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  devolverAnticipo,
  vincularAnticipoEmbarque,
  type RegistrarAnticipoInput,
  type DevolverAnticipoInput,
} from "@/features/anticipos-proveedor/services/anticiposProveedorService";


export function useRegistrarAnticipo() {
  return useMutationWithFeedback({
    mutationFn: (input: RegistrarAnticipoInput) => registrarAnticipo(input),
    // Ola 12 · R3P-02: el anticipo aparece en el estado de cuenta.
    invalidate: [anticiposProveedorKeys.all, queryKeys.proveedores.all],
    successTitle: "Anticipo registrado",
    errorTitle: "No se pudo registrar el anticipo",
    errorMethod: "ANTICIPOS_PROVEEDOR_REGISTRAR",
  });
}

interface AplicarAnticipoVars {
  anticipoId: string;
  facturaId: string;
  monto: number;
  fechaAplicacion?: string;
}

export function useAplicarAnticipo() {
  // BL-08: llave de idempotencia por intento de submit — un doble click o
  // retry de React Query reenvía la MISMA llave y el servidor deduplica;
  // al concluir con éxito se regenera para el siguiente submit.
  const requestIdRef = useRef(crypto.randomUUID());
  return useMutationWithFeedback({
    mutationFn: (v: AplicarAnticipoVars) =>
      aplicarAnticipo(v.anticipoId, v.facturaId, v.monto, v.fechaAplicacion, requestIdRef.current),
    onSuccess: () => {
      requestIdRef.current = crypto.randomUUID();
    },
    // Ola 12 · R3P-02.
    invalidate: [anticiposProveedorKeys.all, queryKeys.cxp.all, queryKeys.proveedores.all],
    successTitle: "Anticipo aplicado a la factura",
    errorTitle: "No se pudo aplicar el anticipo",
    errorMethod: "ANTICIPOS_PROVEEDOR_APLICAR",
  });
}

interface CancelarAnticipoVars {
  id: string;
  motivo: string;
}

export function useCancelarAnticipo() {
  return useMutationWithFeedback({
    mutationFn: (v: CancelarAnticipoVars) => cancelarAnticipo(v.id, v.motivo),
    // Ola 12 · R3P-02: el anticipo aparece en el estado de cuenta.
    invalidate: [anticiposProveedorKeys.all, queryKeys.proveedores.all],
    successTitle: "Anticipo cancelado",
    errorTitle: "No se pudo cancelar el anticipo",
    errorMethod: "ANTICIPOS_PROVEEDOR_CANCELAR",
  });
}

/**
 * N13 · devolución simple del anticipo (el proveedor regresó el dinero).
 * Invalida tesorería porque la devolución genera un ingreso por conciliar.
 */
export function useDevolverAnticipo() {
  return useMutationWithFeedback({
    mutationFn: (v: DevolverAnticipoInput) => devolverAnticipo(v),
    invalidate: [
      anticiposProveedorKeys.all,
      queryKeys.proveedores.all,
      queryKeys.tesoreria.all,
    ],
    successTitle: "Devolución registrada",
    errorTitle: "No se pudo registrar la devolución",
    errorMethod: "ANTICIPOS_PROVEEDOR_DEVOLVER",
  });
}

interface VincularEmbarqueVars {
  id: string;
  embarqueId: string | null;
}

export function useVincularAnticipoEmbarque() {
  return useMutationWithFeedback({
    mutationFn: (v: VincularEmbarqueVars) => vincularAnticipoEmbarque(v.id, v.embarqueId),
    // Ola 12 · R3P-02: el anticipo aparece en el estado de cuenta.
    invalidate: [anticiposProveedorKeys.all, queryKeys.proveedores.all],
    successTitle: "Embarque actualizado",
    errorTitle: "No se pudo vincular el embarque",
    errorMethod: "ANTICIPOS_PROVEEDOR_VINCULAR_EMBARQUE",
  });
}

