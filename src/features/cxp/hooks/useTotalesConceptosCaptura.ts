import type { Dispatch, SetStateAction } from "react";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/types";
import { importesConceptosEditados } from "../utils/impuestosConceptos";
import { normalizarConceptoPersistible } from "../utils/conceptosPersistibles";
import { roundMoney } from "@/lib/financial/financialUtils";

/** Adopción explícita para captura manual; nunca recalcula documentos importados. */
export function useTotalesConceptosCaptura(args: {
  manual: boolean;
  guardando: boolean;
  conceptos: ReadonlyArray<CfdiConceptoParsed>;
  values: FacturaFormValues;
  setValues: Dispatch<SetStateAction<FacturaFormValues>>;
  onAplicar?: () => void;
}) {
  const { manual, guardando, conceptos, values, setValues } = args;
  const retenciones = Number(values.retenciones || 0);
  const normalizados = conceptos.map(normalizarConceptoPersistible);
  const datosValidos = conceptos.length > 0 && conceptos.every((c) =>
    c.descripcion.trim() !== "" && Number.isFinite(c.cantidad ?? 1) && (c.cantidad ?? 1) > 0 &&
    [c.importe, c.iva, c.ieps].every((n) => Number.isFinite(n) && n >= 0)) &&
    normalizados.every((c) => (c.cantidad ?? 1) > 0);
  const propuesta = manual && datosValidos && Number.isFinite(retenciones) && retenciones >= 0
    ? importesConceptosEditados(normalizados.map((c) => ({ ...c, monto: c.importe })), { iva: 0, ieps: 0 }, retenciones)
    : null;
  const difiere = propuesta != null && values.subtotal !== "" &&
    (["subtotal", "iva", "ieps"] as const).some((k) => roundMoney(Number(values[k] || 0) - propuesta[k]) !== 0);
  const puedeAplicar = propuesta != null && !guardando;
  const aplicar = () => {
    if (!puedeAplicar || !propuesta) return;
    setValues((prev) => ({ ...prev, subtotal: propuesta.subtotal.toFixed(2),
      iva: propuesta.iva.toFixed(2), ieps: propuesta.ieps.toFixed(2) }));
    args.onAplicar?.();
    // Las retenciones pertenecen a la cabecera: no se infieren ni se borran.
  };
  return { visible: manual && conceptos.length > 0, propuesta, difiere, puedeAplicar, aplicar };
}
