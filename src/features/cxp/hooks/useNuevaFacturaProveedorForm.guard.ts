/**
 * Validación de conceptos previa al submit (bloqueo Q-02) y del tope de
 * vinculación (una factura no puede cubrir más de su subtotal).
 * Extraído de `useNuevaFacturaProveedorForm.ts` (Power-of-10, ≤200 líneas).
 */
import { notifyError } from "@/lib/ui/appFeedback";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import type { ResultadoCuadre } from "@/features/cxp/utils/cuadreConceptos";
import { formatCurrency } from "@/lib/formatters";
import type { ResultadoTopeVinculacion } from "@/features/cxp/utils/topeVinculacion";

interface ConceptosManualesLike {
  conceptos: ReadonlyArray<unknown>;
}

/**
 * Devuelve `true` si el submit puede continuar; en caso de bloqueo notifica
 * el error correspondiente y devuelve `false`.
 */
export function puedeContinuarSubmit(
  cfdiConceptos: ReadonlyArray<CfdiConceptoParsed>,
  hayVinculos: boolean,
  manuales: ConceptosManualesLike,
  cuadreManual: ResultadoCuadre,
  subtotal: number,
): boolean {
  if (cfdiConceptos.length > 0 || hayVinculos) return true;

  if (manuales.conceptos.length === 0) {
    notifyError(undefined, {
      title: "Captura los conceptos de la factura",
      description: "Sin partidas no podrás aprobarla ni pagarla. Agrega al menos un concepto.",
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_SIN_CONCEPTOS",
    });
    return false;
  }
  if (!cuadreManual.puedeAprobar) {
    notifyError(undefined, {
      title: "Los conceptos no cuadran con el subtotal",
      description: `Suma de conceptos ${cuadreManual.suma.toFixed(2)} vs subtotal ${subtotal.toFixed(2)}. Ajusta la diferencia (tolerancia 0.01).`,
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_DESCUADRE",
    });
    return false;
  }
  return true;
}

/**
 * Candado del tope de vinculación: bloquea el guardado cuando la suma asignada
 * a conceptos de costo excede el subtotal de la factura.
 */
export function puedeContinuarTope(
  tope: ResultadoTopeVinculacion,
  subtotal: number,
  moneda: string,
): boolean {
  if (!tope.excede) return true;
  notifyError(undefined, {
    title: "Vinculaste más de lo que vale la factura",
    description: `Asignaste ${formatCurrency(tope.asignado, moneda)} a conceptos de embarque, pero el subtotal de la factura es ${formatCurrency(subtotal, moneda)}. Sobran ${formatCurrency(tope.excedente, moneda)}: baja un monto o desmarca conceptos.`,
    method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_TOPE_VINCULACION",
  });
  return false;
}

