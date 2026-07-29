/**
 * Efecto de auto-fetch del TC DOF al cambiar moneda/fecha de emisión.
 * Extraído de `useNuevaFacturaProveedorForm.ts` (Power-of-10, ≤200 líneas).
 */
import { useEffect, type MutableRefObject } from "react";
import { isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import type { TcOrigen } from "@/features/cxp/types";

interface TcDofLike {
  mutate: (args: { moneda: MonedaTc; fecha: string; silent: boolean }) => void;
}

export function useAutoTcEffect(
  moneda: string,
  emision: string,
  tcOrigenRef: MutableRefObject<TcOrigen>,
  tcDofRef: MutableRefObject<TcDofLike>,
): void {
  useEffect(() => {
    if (moneda === "MXN") return;
    if (!isFechaEmisionValida(emision)) return;
    const origen = tcOrigenRef.current;
    if (origen === "manual" || origen === "cfdi") return;
    const t = setTimeout(() => {
      tcDofRef.current.mutate({ moneda: moneda as MonedaTc, fecha: emision, silent: true });
    }, 250);
    return () => clearTimeout(t);
  }, [moneda, emision, tcOrigenRef, tcDofRef]);
}
