/** Mutaciones del feature Anticipos a Proveedor — usan `useMutationWithFeedback`. */
import { useMutationWithFeedback } from "@/hooks/shared";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";
import { queryKeys } from "@/lib/query";
import {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  vincularAnticipoEmbarque,
  type RegistrarAnticipoInput,
} from "@/features/anticipos-proveedor/services/anticiposProveedorService";


export function useRegistrarAnticipo() {
  return useMutationWithFeedback({
    mutationFn: (input: RegistrarAnticipoInput) => registrarAnticipo(input),
    invalidate: [anticiposProveedorKeys.all],
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
  return useMutationWithFeedback({
    mutationFn: (v: AplicarAnticipoVars) =>
      aplicarAnticipo(v.anticipoId, v.facturaId, v.monto, v.fechaAplicacion),
    invalidate: [anticiposProveedorKeys.all, queryKeys.cxp.all],
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
    invalidate: [anticiposProveedorKeys.all],
    successTitle: "Anticipo cancelado",
    errorTitle: "No se pudo cancelar el anticipo",
    errorMethod: "ANTICIPOS_PROVEEDOR_CANCELAR",
  });
}

interface VincularEmbarqueVars {
  id: string;
  embarqueId: string | null;
}

export function useVincularAnticipoEmbarque() {
  return useMutationWithFeedback({
    mutationFn: (v: VincularEmbarqueVars) => vincularAnticipoEmbarque(v.id, v.embarqueId),
    invalidate: [anticiposProveedorKeys.all],
    successTitle: "Embarque actualizado",
    errorTitle: "No se pudo vincular el embarque",
    errorMethod: "ANTICIPOS_PROVEEDOR_VINCULAR_EMBARQUE",
  });
}

