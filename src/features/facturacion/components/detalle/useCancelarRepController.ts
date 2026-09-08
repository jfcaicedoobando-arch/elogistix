/**
 * Controlador del diálogo de cancelación de REP.
 * Responsabilidades:
 *  - Ejecutar la cancelación ante el SAT vía `useCancelarRep`.
 *  - Si el SAT acepta la cancelación, eliminar el pago local para que la
 *    factura vuelva a reflejar saldo pendiente.
 *  - Si la cancelación queda en verificación, dejar el pago intacto y avisar.
 *  - Registrar actividad de auditoría en el éxito total.
 */
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCancelarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import { useEliminarPagoFactura } from "@/features/facturacion/hooks";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { useRegistrarActividad } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";

export interface PagoRepInfo {
  id: string;
  fecha_pago: string;
  monto: number | string;
  moneda: string;
  serie_rep?: number | string | null;
  folio_rep?: number | string | null;
  uuid_rep?: string | null;
}

export type ResultadoCancelacionRep = "accepted" | "accepted_sync_failed" | "pending" | "uncertain" | "error" | null;

interface UseCancelarRepControllerReturn {
  motivo: MotivoCancelacionSat;
  setMotivo: (m: MotivoCancelacionSat) => void;
  resultado: ResultadoCancelacionRep;
  confirmar: () => Promise<ResultadoCancelacionRep>;
  isPending: boolean;
}

function motivoDefault(): MotivoCancelacionSat {
  return MOTIVOS_CANCELACION_SAT[0].value;
}

export function useCancelarRepController(
  pago: PagoRepInfo | null,
  facturaId: string,
  facturaNumero: string,
): UseCancelarRepControllerReturn {
  const [motivo, setMotivo] = useState<MotivoCancelacionSat>(motivoDefault());
  const [resultado, setResultado] = useState<ResultadoCancelacionRep>(null);
  const cancelar = useCancelarRep(facturaId, { silenciarToasts: true });
  const eliminar = useEliminarPagoFactura();
  const qc = useQueryClient();
  const registrarActividad = useRegistrarActividad();

  const resetear = useCallback(() => {
    setMotivo(motivoDefault());
    setResultado(null);
  }, []);

  useEffect(() => {
    resetear();
  }, [pago?.id, resetear]);

  const invalidarQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.bandejaRepsHistorico() });
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.bandejaRepPendientes() });
  }, [qc, facturaId]);

  const confirmar = useCallback(async (): Promise<ResultadoCancelacionRep> => {
    if (!pago) return "error";
    try {
      const res = await cancelar.mutateAsync({ pagoId: pago.id, motivo });

      if (res.uncertain) {
        invalidarQueries();
        setResultado("uncertain");
        return "uncertain";
      }

      const status = (res.cancellation_status ?? "").toLowerCase();
      const enVerificacion = res.pending || status === "pending" || status === "verifying";
      const aceptada = status === "accepted" && !enVerificacion;

      if (aceptada) {
        registrarActividad.mutate({
          accion: "cancelar_rep",
          modulo: "facturas",
          entidad_id: facturaId,
          entidad_nombre: `REP ${pago.serie_rep ?? ""}${pago.folio_rep ?? pago.id.slice(0, 8)} cancelado ante SAT - factura ${facturaNumero}`,
          detalles: { pago_id: pago.id, uuid_rep: pago.uuid_rep },
        });

        try {
          await eliminar.mutateAsync({ id: pago.id, facturaId });
        } catch {
          invalidarQueries();
          setResultado("accepted_sync_failed");
          return "accepted_sync_failed";
        }

        registrarActividad.mutate({
          accion: "eliminar_pago",
          modulo: "facturas",
          entidad_id: facturaId,
          entidad_nombre: `Pago eliminado tras cancelación REP - factura ${facturaNumero}`,
          detalles: { pago_id: pago.id },
        });
        invalidarQueries();
        setResultado("accepted");
        return "accepted";
      }

      if (enVerificacion) {
        invalidarQueries();
        setResultado("pending");
        return "pending";
      }

      setResultado("error");
      return "error";
    } catch {
      setResultado("error");
      return "error";
    }
  }, [pago, motivo, cancelar, eliminar, facturaId, facturaNumero, registrarActividad, invalidarQueries]);

  return {
    motivo,
    setMotivo,
    resultado,
    confirmar,
    isPending: cancelar.isPending || eliminar.isPending,
  };
}
