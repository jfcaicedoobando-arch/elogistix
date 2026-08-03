/**
 * Estado crudo del formulario de pago a proveedor (campos + precarga).
 * Extraído v13.395.0 para mantener la complejidad del hook principal baja.
 */
import { useEffect, useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { defaultMetodo } from "@/features/cxp/components/pagoProveedorHelpers";
import {
  valoresInicialesCreacion,
  valoresInicialesEdicion,
  type PagoEditable,
} from "./usePagoProveedorForm.editar";

type Moneda = Database["public"]["Enums"]["moneda"];

interface FacturaBase {
  saldo: number;
  moneda: Moneda;
  tipo_cambio_usd?: number | null;
  proveedor_origen: string | null;
}

export function usePagoProveedorCampos(
  factura: FacturaBase | null,
  open: boolean,
  hoy: string,
  pagoEditar: PagoEditable | null,
) {
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [tc, setTc] = useState("");
  const [metodo, setMetodo] = useState<string>("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [diffMxn, setDiffMxn] = useState<string>("");
  const [cuentaId, setCuentaId] = useState<string>("");

  const pagoEditarId = pagoEditar?.id ?? null;

  useEffect(() => {
    if (!factura || !open) return;
    const v = pagoEditar
      ? valoresInicialesEdicion(pagoEditar)
      : valoresInicialesCreacion(factura, hoy, defaultMetodo(factura.proveedor_origen));
    setFecha(v.fecha);
    setMonto(v.monto);
    setMoneda(v.moneda);
    setTc(v.tc);
    setMetodo(v.metodo);
    setReferencia(v.referencia);
    setNotas(v.notas);
    setDiffMxn(v.diffMxn);
    if (pagoEditar) setCuentaId(v.cuentaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factura, open, hoy, pagoEditarId]);

  return {
    fecha, setFecha, monto, setMonto, moneda, setMoneda, tc, setTc,
    metodo, setMetodo, referencia, setReferencia, notas, setNotas,
    diffMxn, setDiffMxn, cuentaId, setCuentaId, pagoEditarId,
  };
}
