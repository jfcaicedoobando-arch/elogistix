/**
 * Lista corta de pendientes junto al botón "Guardar factura".
 *
 * v13.422.0 — Antes el botón se deshabilitaba sin explicar qué faltaba.
 * Deriva los pendientes de los valores que el formulario ya conoce; no
 * introduce reglas nuevas de validación.
 */
import { AlertCircle } from "lucide-react";
import type { FacturaFormValues } from "@/features/cxp/types";

interface Props {
  values: FacturaFormValues;
  total: number;
  /** El tope de vinculación excedido bloquea el guardado. */
  topeExcedido?: boolean;
  /** CFDI ya capturado previamente. */
  cfdiDuplicado?: boolean;
}

export function pendientesDeCaptura({
  values, total, topeExcedido, cfdiDuplicado,
}: Props): string[] {
  const faltan: string[] = [];
  if (!values.provId) faltan.push("Falta el proveedor");
  if (!values.folio.trim()) faltan.push("Falta el folio del proveedor");
  if (total <= 0) faltan.push("Falta el importe de la factura");
  if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
    faltan.push("Falta el tipo de cambio");
  }
  if (topeExcedido) faltan.push("Lo vinculado excede el subtotal");
  if (cfdiDuplicado) faltan.push("Este CFDI ya está capturado");
  return faltan;
}

export function PendientesGuardarHint(props: Props) {
  const faltan = pendientesDeCaptura(props);
  if (faltan.length === 0) return null;

  return (
    <p
      className="mr-auto flex items-start gap-1.5 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span>{faltan.join(" · ")}</span>
    </p>
  );
}
