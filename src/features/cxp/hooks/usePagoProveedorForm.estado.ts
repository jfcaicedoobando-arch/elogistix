/**
 * Estado crudo del formulario de pago a proveedor (campos + precarga).
 * Extraído v13.395.0 para mantener la complejidad del hook principal baja.
 */
import { useEffect, useRef, useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type OrigenProveedor = Database["public"]["Enums"]["origen_proveedor"] | null;
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
  proveedor_origen: OrigenProveedor;
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
  // Guardamos el pago en un ref: la precarga sólo debe re-ejecutarse cuando
  // cambia su `id` (no en cada nueva referencia del objeto), y así el effect
  // declara todas sus dependencias sin desactivar reglas de React.
  const pagoEditarRef = useRef(pagoEditar);
  pagoEditarRef.current = pagoEditar;

  // A-6 (auditoría v14): espejo del patrón FE-02 de CxC. El diálogo invalida
  // la query de la factura al abrirse (B-037); si el refetch trae un objeto
  // nuevo (saldo actualizado por otro usuario), el efecto de precarga se
  // re-ejecutaba y PISABA lo que el usuario ya había capturado. Se inicializa
  // una sola vez por apertura (llave = open + factura.id + pagoEditarId).
  const initializedForRef = useRef<string | null>(null);
  const initKey = factura ? `${factura as { id?: string }.id ?? "sin-id"}:${pagoEditarId ?? "nuevo"}` : null;

  useEffect(() => {
    if (!factura || !open || !initKey) {
      initializedForRef.current = null;
      return;
    }
    if (initializedForRef.current === initKey) return;
    initializedForRef.current = initKey;
    const pago = pagoEditarRef.current;
    const v = pago
      ? valoresInicialesEdicion(pago)
      : valoresInicialesCreacion(factura, hoy, defaultMetodo(factura.proveedor_origen));
    setFecha(v.fecha);
    setMonto(v.monto);
    setMoneda(v.moneda);
    setTc(v.tc);
    setMetodo(v.metodo);
    setReferencia(v.referencia);
    setNotas(v.notas);
    setDiffMxn(v.diffMxn);
    if (pago) setCuentaId(v.cuentaId);
  }, [factura, open, hoy, pagoEditarId]);

  return {
    fecha, setFecha, monto, setMonto, moneda, setMoneda, tc, setTc,
    metodo, setMetodo, referencia, setReferencia, notas, setNotas,
    diffMxn, setDiffMxn, cuentaId, setCuentaId, pagoEditarId,
  };
}
