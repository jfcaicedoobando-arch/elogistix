/**
 * Handlers del tipo de cambio DOF para useNuevaFacturaProveedorForm.
 * Extraído para mantener el hook principal <200 líneas (Power of 10).
 */
import { useEffect, useRef } from "react";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import type { TcOrigen } from "@/features/cxp/components/FacturaProveedorFormFields";
import { useTcDofPorFecha, isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";

export function useTcDofAutoFetch(params: {
  values: FacturaFormValues;
  tcOrigen: TcOrigen;
  onDofResult: (r: { tipoCambio: number; fechaAplicada: string }) => void;
}) {
  const { values, tcOrigen, onDofResult } = params;

  const tcDof = useTcDofPorFecha(onDofResult);

  const tcDofRef = useRef(tcDof);
  const tcOrigenRef = useRef(tcOrigen);
  tcDofRef.current = tcDof;
  tcOrigenRef.current = tcOrigen;

  // Auto-fetch del TC DOF cuando hay moneda ≠ MXN + fecha emisión válida.
  useEffect(() => {
    if (values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    const origen = tcOrigenRef.current;
    if (origen === "manual" || origen === "cfdi") return;
    const t = setTimeout(() => {
      tcDofRef.current.mutate({
        moneda: values.moneda as MonedaTc,
        fecha: values.emision,
        silent: true,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [values.moneda, values.emision]);

  const obtenerDofManual = (resetManualFlag: () => void) => {
    if (values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    resetManualFlag();
    tcDof.mutate({
      moneda: values.moneda as MonedaTc,
      fecha: values.emision,
      silent: false,
    });
  };

  return { tcDof, obtenerDofManual };
}
