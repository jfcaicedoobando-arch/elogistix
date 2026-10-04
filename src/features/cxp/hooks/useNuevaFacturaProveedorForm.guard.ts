/**
 * Validación de conceptos previa al submit (bloqueo Q-02) y del tope de
 * vinculación (una factura no puede cubrir más de su subtotal).
 * Extraído de `useNuevaFacturaProveedorForm.ts` (Power-of-10, ≤200 líneas).
 */
import { calcularCuadreCaptura, cantidadesCapturaValidas } from "../utils/conceptosPersistibles";
import { notifyError } from "@/lib/ui/appFeedback";
import type { FacturaFormValues } from "../types";
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
export interface ArgsSubmitGuard {
  cfdiConceptos: ReadonlyArray<CfdiConceptoParsed>;
  hayVinculos: boolean;
  manuales: ConceptosManualesLike;
  cuadreManual: ResultadoCuadre;
  subtotal: number;
  moneda?: string;
}

export function puedeContinuarSubmit(args: ArgsSubmitGuard): boolean {
  const { cfdiConceptos, hayVinculos, manuales, cuadreManual, subtotal } = args;
  const moneda = args.moneda ?? "MXN";
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
      description: `Suma de conceptos ${formatCurrency(cuadreManual.suma, moneda)} vs subtotal ${formatCurrency(subtotal, moneda)}. Ajusta la diferencia (tolerancia 0.01).`,
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


/** Defensa antes de insertar cabecera, también para XML/PDF y líneas sin vínculo. */
function validarConceptosPersistibles(
  conceptos: ReadonlyArray<CfdiConceptoParsed>, subtotal: number, moneda: string,
): boolean {
  if (!conceptos.length) return true;
  if (!cantidadesCapturaValidas(conceptos)) {
    notifyError(undefined, {
      title: "Revisa las cantidades de los conceptos",
      description: "Cada cantidad debe ser al menos 0.000001; se admiten hasta 6 decimales.",
      method: "CXP_CONCEPTOS_CANTIDAD_INVALIDA",
    });
    return false;
  }
  const cuadre = calcularCuadreCaptura(subtotal,
    conceptos.map((c) => ({ monto: c.importe, cantidad: c.cantidad })));
  if (cuadre.puedeAprobar) return true;
  notifyError(undefined, {
    title: "Los conceptos no cuadran con el subtotal",
    description: `Con precios a 2 decimales, los conceptos suman ${formatCurrency(cuadre.suma, moneda)} y el subtotal es ${formatCurrency(subtotal, moneda)}. Revisa los conceptos y los importes antes de guardar.`,
    method: "CXP_CONCEPTOS_NORMALIZADOS_DESCUADRE",
  });
  return false;
}

/** Validación final sobre los valores normalizados, antes de crear la cabecera. */
export function puedePersistirFactura(
  values: FacturaFormValues, conceptos: ReadonlyArray<CfdiConceptoParsed>,
): boolean {
  if (!values.categoriaId) {
    notifyError(undefined, {
      title: "Falta la categoría contable",
      description: "Selecciona la categoría de presupuesto antes de guardar la factura.",
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_CATEGORIA_PRE",
    });
    return false;
  }
  return validarConceptosPersistibles(conceptos, Number(values.subtotal) || 0, values.moneda);
}
