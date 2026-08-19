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
        .int({ message: "Los días de crédito deben ser un número entero" })
        .min(0, { message: "Los días de crédito no pueden ser negativos" })
        .max(365, { message: "Los días de crédito no pueden ser mayores a 365" }),
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
    refCtx.addIssue({ code: "custom", path: ["provId"], message: "Selecciona un proveedor" });
  }
  if (!values.folio.trim()) {
    refCtx.addIssue({ code: "custom", path: ["folio"], message: "Captura el folio del proveedor" });
  }
  // P1-2: sin fecha de emisión el índice único de la BD (proveedor + folio
  // + fecha) no puede evaluarse y el 23505 llega crudo al toast.
  if (!values.emision.trim()) {
    refCtx.addIssue({ code: "custom", path: ["emision"], message: "La fecha de emisión es obligatoria" });
  }
  if (!values.categoriaId) {
    refCtx.addIssue({ code: "custom", path: ["categoriaId"], message: "Selecciona una categoría contable" });
  }
}

/**
 * FE-06a: componentes no negativos. Sin esto, subtotal = -100 e iva = 200
 * dan total = 100 y pasaban la única validación existente (total > 0).
 */
function validarImportes(values: Valores, refCtx: RefCtx, ctx: FacturaFormValidationContext): void {
  const componentes: Array<[string, string, string]> = [
    ["subtotal", values.subtotal, "El subtotal no puede ser negativo"],
    ["iva", values.iva, "El IVA no puede ser negativo"],
    ["ieps", values.ieps, "El IEPS no puede ser negativo"],
    ["retenciones", values.retenciones, "Las retenciones no pueden ser negativas"],
  ];
  for (const [campo, texto, mensaje] of componentes) {
    if (texto.trim() !== "" && Number(texto) < 0) {
      refCtx.addIssue({ code: "custom", path: [campo], message: mensaje });
    }
  }
  if (ctx.total <= 0) {
    refCtx.addIssue({ code: "custom", path: ["subtotal"], message: "El total debe ser mayor a 0" });
  }
}

/** FE-06b y EC-18: coherencia de emisión vs. vencimiento. */
function validarFechas(values: Valores, refCtx: RefCtx): void {
  if (!values.emision.trim() || !values.vencimiento.trim()) return;
  if (values.vencimiento < values.emision) {
    refCtx.addIssue({
      code: "custom",
      path: ["vencimiento"],
      message: "La fecha de vencimiento no puede ser anterior a la fecha de emisión",
    });
  }
  // Ola 19 · paso 1: un solo cálculo de días naturales (helper central).
  if (diffDiasCalendario(values.emision, values.vencimiento) > 366) {
    refCtx.addIssue({
      code: "custom",
      path: ["vencimiento"],
      message: "La fecha de vencimiento está demasiado lejos de la emisión",
    });
  }
}

/** Tipo de cambio obligatorio en divisa y acotado a TC_MAX = 1000 (FE-06c). */
function validarTipoCambio(values: Valores, refCtx: RefCtx): void {
  if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
    refCtx.addIssue({ code: "custom", path: ["tc"], message: "Captura el tipo de cambio" });
  }
  if (Number(values.tc) > 1000) {
    refCtx.addIssue({
      code: "custom",
      path: ["tc"],
      message: "El tipo de cambio no puede ser mayor a 1000",
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
