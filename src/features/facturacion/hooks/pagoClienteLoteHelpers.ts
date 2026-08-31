/**
 * Hooks auxiliares del cobro en lote de cliente: facturas que exigirán REP y
 * tipo de cambio del lote.
 *
 * Extraído de `usePagoClienteLoteState.ts` (límite Power-of-10 de 200 líneas).
 */
import { useEffect, useState } from "react";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import {
  obtenerFacturasConRep,
  type FacturaCobroCandidata,
} from "@/features/facturacion/services/pagoClienteLote";

/**
 * Aviso previo: cuáles de las facturas candidatas exigirán REP (PPD timbradas).
 */
export function useIdsConRep(open: boolean, facturas: FacturaCobroCandidata[]): string[] {
  const [idsConRep, setIdsConRep] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    const ids = facturas.map((f) => f.factura_id);
    obtenerFacturasConRep(ids)
      .then((res) => {
        if (vivo) setIdsConRep(res);
      })
      .catch(() => {
        if (vivo) setIdsConRep([]);
      });
    return () => {
      vivo = false;
    };
  }, [open, facturas]);
  return idsConRep;
}

/**
 * Ola 5 · RG4-11: el TC que se guarda es el de la MONEDA DEL LOTE.
 * Antes un lote EUR guardaba el TC DOF USD en tipo_cambio_usd.
 */
export function useTcLote(open: boolean, moneda: string, fecha: string) {
  const esExtranjera = moneda !== "MXN";
  const pedirTc = open && esExtranjera;
  const { data: tcDofRaw } = useTcDofPorFecha(pedirTc ? fecha : null, pedirTc);
  const tcDof = esExtranjera ? tcDofRaw ?? null : null;
  const porMoneda = moneda === "EUR" ? tcDof?.eurMxn : tcDof?.usdMxn;
  const tcAplicable = esExtranjera ? porMoneda ?? null : null;
  return { tcDof, tcAplicable };
}
