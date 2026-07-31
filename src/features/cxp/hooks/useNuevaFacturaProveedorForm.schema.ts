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
      diasCredito: z.number(),
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
      if (!values.provId) {
        refCtx.addIssue({ code: "custom", path: ["provId"], message: "Selecciona un proveedor" });
      }
      if (!values.folio.trim()) {
        refCtx.addIssue({ code: "custom", path: ["folio"], message: "Captura el folio del proveedor" });
      }
      // P1-2: sin fecha de emisión el índice único de la BD (proveedor + folio
      // + fecha) no puede evaluarse y el 23505 llega crudo al toast.
      if (!values.emision.trim()) {
        refCtx.addIssue({
          code: "custom",
          path: ["emision"],
          message: "La fecha de emisión es obligatoria",
        });
      }
      if (!values.categoriaId) {
        refCtx.addIssue({ code: "custom", path: ["categoriaId"], message: "Selecciona una categoría contable" });
      }
      if (ctx.total <= 0) {
        refCtx.addIssue({ code: "custom", path: ["subtotal"], message: "El total debe ser mayor a 0" });
      }
      if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
        refCtx.addIssue({ code: "custom", path: ["tc"], message: "Captura el tipo de cambio" });
      }
    });
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
