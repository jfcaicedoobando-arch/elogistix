/**
 * Shim de compatibilidad sobre Sonner.
 *
 * v12.16.0 — El stack shadcn/Radix `useToast` fue retirado. Para no tocar los
 * ~70 call sites existentes (`const { toast } = useToast(); toast({...})`),
 * exportamos un `toast()` con la MISMA firma legacy `{ title, description,
 * variant }` que internamente delega en `sonner`.
 *
 * v13.140.x — Política canónica de toasts:
 *  - Mensajes generales de feature → `useToast()` + helpers de
 *    `@/lib/ui/appFeedback` (`notifyError`, `notifySuccess`,
 *    `notifyWarning`).
 *  - Toasts minimalistas/silenciados del CRM → `crmToast` en
 *    `@/features/crm/lib/crmToast`.
 *  - **No** importes `toast` directamente desde `sonner` en features. La
 *    única razón válida para importar `sonner` es dentro de los shims
 *    anteriores. Esto garantiza estilos uniformes, manejo único de
 *    debug/`ErrorDetailsDialog` y traducciones consistentes.
 */

import { toast as sonnerToast } from "sonner";
import type { ReactNode } from "react";
import { openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import type { ErrorReport } from "@/lib/ui/errorReport";

type Variant = "default" | "destructive" | "warning" | "success";

interface LegacyToastProps {
  title?: ReactNode;
  description?: ReactNode;
  variant?: Variant;
  duration?: number;
  /** Payload de debug — abre el ErrorDetailsDialog desde la acción "Ver detalles". */
  debug?: ErrorReport;
  // Otras props legacy se ignoran silenciosamente.
  [key: string]: unknown;
}

function toReactString(node: ReactNode): string | undefined {
  if (node == null || typeof node === "boolean") return undefined;
  if (typeof node === "string" || typeof node === "number") return String(node);
  // Para nodos JSX caemos a undefined; los call sites del proyecto pasan strings.
  return undefined;
}

function toast(props: LegacyToastProps) {
  const { title, description, variant = "default", duration, debug } = props;
  const t = toReactString(title) ?? "";
  const d = toReactString(description);

  const action = debug
    ? { label: "Ver detalles", onClick: () => openErrorReport(debug) }
    : undefined;

  const base = { description: d, duration: debug ? Infinity : duration, action };

  let id: string | number;
  switch (variant) {
    case "destructive":
      id = sonnerToast.error(t, base);
      break;
    case "warning":
      id = sonnerToast.warning(t, base);
      break;
    case "success":
      id = sonnerToast.success(t, base);
      break;
    default:
      id = sonnerToast(t, base);
  }

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {
      /* no-op: sonner gestiona el ciclo de vida. */
    },
  };
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as Array<{ id: string }>,
  };
}

export { useToast, toast };
