/**
 * Zod schema — single source of truth para validación de captura de facturas
 * de proveedor. PR-6 · Ítem 3.3 (auditoría-4): unifica el paradigma de
 * validación reemplazando la lógica imperativa previa en
 * `validateFactura`. El schema conserva los mismos mensajes de error para
 * mantener retrocompatibilidad con la UI y los tests existentes.
 *
 * Nota: la migración total a `react-hook-form` (11 `useState` → 1 `useForm`)
 * se difiere a un PR siguiente para acotar el blast radius. Esta pieza
 * consolida el schema de validación como paso 1 no-invasivo.
 */
import { z } from "zod";
import type { FacturaFormValues } from "@/features/cxp/types";
import { diffDiasCalendario } from "@/lib/date/dateOnly";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

export interface FacturaFormValidationContext {
  total: number;
}

/**
 * Schema del formulario. Los campos numéricos se conservan como `string`
 * (control directo desde inputs `type="number"` sin RHF); las reglas
 * cruzadas (`total > 0`, `tc > 0` cuando la moneda no es MXN) se resuelven
 * vía `superRefine` para poder inyectar el `total` calculado.
 */
export function buildFacturaFormSchema(ctx: FacturaFormValidationContext) {
  return z
    .object({
      provId: z.string(),
      provNombre: z.string(),
      folio: z.string(),
      emision: z.string(),
      // EC-18: era el único numérico sin límites; 99999 días recalculaba el
      // vencimiento a fechas absurdas (año 2299) y distorsionaba el aging.
      diasCredito: z
        .number()
        .int({ message: COPY_VALIDACION.diasCreditoEntero })
        .min(0, { message: COPY_VALIDACION.diasCreditoNegativo })
        .max(365, { message: COPY_VALIDACION.diasCreditoMaximo }),
      vencimiento: z.string(),
      moneda: z.string(),
      tc: z.string(),
      subtotal: z.string(),
      iva: z.string(),
      ieps: z.string(),
      retenciones: z.string(),
      categoriaId: z.string(),
      notas: z.string(),
    })
    .superRefine((values, refCtx) => {
      validarObligatorios(values, refCtx);
      validarImportes(values, refCtx, ctx);
      validarFechas(values, refCtx);
      validarTipoCambio(values, refCtx);
    });
}

/** Emisor de issues de zod acotado a lo que usan los validadores de abajo. */
type RefCtx = { addIssue: (issue: { code: "custom"; path: string[]; message: string }) => void };
type Valores = {
  provId: string; folio: string; emision: string; vencimiento: string;
  categoriaId: string; moneda: string; tc: string;
  subtotal: string; iva: string; ieps: string; retenciones: string;
};

/** Campos que no pueden quedar vacíos. */
function validarObligatorios(values: Valores, refCtx: RefCtx): void {
  if (!values.provId) {
    refCtx.addIssue({ code: "custom", path: ["provId"], message: COPY_VALIDACION.proveedorRequerido });
  }
  if (!values.folio.trim()) {
    refCtx.addIssue({ code: "custom", path: ["folio"], message: COPY_VALIDACION.folioProveedorRequerido });
  }
  // P1-2: sin fecha de emisión el índice único de la BD (proveedor + folio
  // + fecha) no puede evaluarse y el 23505 llega crudo al toast.
  if (!values.emision.trim()) {
    refCtx.addIssue({ code: "custom", path: ["emision"], message: COPY_VALIDACION.emisionRequerida });
  }
  if (!values.categoriaId) {
    refCtx.addIssue({ code: "custom", path: ["categoriaId"], message: COPY_VALIDACION.categoriaContableRequerida });
  }
}

/**
 * FE-06a: componentes no negativos. Sin esto, subtotal = -100 e iva = 200
 * dan total = 100 y pasaban la única validación existente (total > 0).
 */
function validarImportes(values: Valores, refCtx: RefCtx, ctx: FacturaFormValidationContext): void {
  const componentes: Array<[string, string, string]> = [
    ["subtotal", values.subtotal, COPY_VALIDACION.subtotalNoNegativo],
    ["iva", values.iva, COPY_VALIDACION.ivaNoNegativo],
    ["ieps", values.ieps, COPY_VALIDACION.iepsNoNegativo],
    ["retenciones", values.retenciones, COPY_VALIDACION.retencionesNoNegativas],
  ];
  for (const [campo, texto, mensaje] of componentes) {
    if (texto.trim() !== "" && Number(texto) < 0) {
      refCtx.addIssue({ code: "custom", path: [campo], message: mensaje });
    }
  }
  if (ctx.total <= 0) {
    refCtx.addIssue({ code: "custom", path: ["subtotal"], message: COPY_VALIDACION.totalMayorACero });
  }
}

/** FE-06b y EC-18: coherencia de emisión vs. vencimiento. */
function validarFechas(values: Valores, refCtx: RefCtx): void {
  if (!values.emision.trim() || !values.vencimiento.trim()) return;
  if (values.vencimiento < values.emision) {
    refCtx.addIssue({
      code: "custom",
      path: ["vencimiento"],
      message: COPY_VALIDACION.vencimientoAnteriorAEmision,
    });
  }
  // Ola 19 · paso 1: un solo cálculo de días naturales (helper central).
  if (diffDiasCalendario(values.emision, values.vencimiento) > 366) {
    refCtx.addIssue({
      code: "custom",
      path: ["vencimiento"],
      message: COPY_VALIDACION.vencimientoDemasiadoLejano,
    });
  }
}

/** Tipo de cambio obligatorio en divisa y acotado a TC_MAX = 1000 (FE-06c). */
function validarTipoCambio(values: Valores, refCtx: RefCtx): void {
  if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
    refCtx.addIssue({ code: "custom", path: ["tc"], message: COPY_VALIDACION.tipoCambioRequerido });
  }
  if (Number(values.tc) > 1000) {
    refCtx.addIssue({
      code: "custom",
      path: ["tc"],
      message: COPY_VALIDACION.tipoCambioMaximo,
    });
  }
}

/**
 * Adapta el resultado de zod al shape que consume el hook controller
 * (`Partial<Record<keyof FacturaFormValues, string>>`), preservando la
 * firma pública de `validateFactura`.
 */
export function facturaFormErrorsFromZod(
  values: FacturaFormValues,
  ctx: FacturaFormValidationContext,
): Partial<Record<keyof FacturaFormValues, string>> {
  const parsed = buildFacturaFormSchema(ctx).safeParse(values);
  if (parsed.success) return {};
  const next: Partial<Record<keyof FacturaFormValues, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof FacturaFormValues | undefined;
    if (key && !next[key]) next[key] = issue.message;
  }
  return next;
}
