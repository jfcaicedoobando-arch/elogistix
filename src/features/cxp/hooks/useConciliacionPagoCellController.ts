/**
 * Lógica de la celda de conciliación CxP (M14 Ola 1, antes inline en
 * components/ConciliacionPagoCell.tsx — S1-07). Dinero: testeable aquí.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { sugerirMovsParaPagoProveedor } from "@/features/cxp/services/conciliacionBancaria";
import { conciliarConPago, desconciliarMovimiento } from "@/features/tesoreria/services/conciliacion";

interface Params {
  pagoId: string;
  fechaPago: string;
  monto: number;
  cuentaBancariaId: string | null;
  tieneMovimiento: boolean;
}

export function useConciliacionPagoCellController({
  pagoId, fechaPago, monto, cuentaBancariaId, tieneMovimiento,
}: Params) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const candidatos = useQuery({
    queryKey: queryKeys.cxp.conciliacionCandidatos(pagoId),
    queryFn: () => sugerirMovsParaPagoProveedor({
      id: pagoId, fecha_pago: fechaPago, monto, cuenta_bancaria_id: cuentaBancariaId,
    }),
    enabled: open && !tieneMovimiento,
    staleTime: 60_000,
  });

  /** Invalidaciones compartidas por vincular/desvincular (antes duplicadas). */
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: queryKeys.pagosProveedor.all });
    qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
    qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
  };

  const vincular = useMutation({
    mutationFn: (movId: string) => conciliarConPago(movId, "cxp", pagoId, user?.id ?? null),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Movimiento vinculado al pago" });
      invalidar();
      setOpen(false);
    },
    onError: (err: Error) => notifyError(undefined, {
      title: `No se pudo vincular: ${err.message}`, error: err,
      method: "FEATURES_CXP_CONCILIACION_VINCULAR",
    }),
  });

  const desvincular = useMutation({
    mutationFn: (movId: string) => desconciliarMovimiento(movId),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Movimiento desvinculado" });
      invalidar();
      setOpen(false);
    },
    onError: (err: Error) => notifyError(undefined, {
      title: `No se pudo desvincular: ${err.message}`, error: err,
      method: "FEATURES_CXP_CONCILIACION_DESVINCULAR",
    }),
  });

  return { open, setOpen, candidatos, vincular, desvincular };
}
