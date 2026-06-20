/**
 * Shim de compatibilidad sobre Sonner.
 *
 * v12.16.0 — El stack shadcn/Radix `useToast` fue retirado. Para no tocar los
 * ~70 call sites existentes (`const { toast } = useToast(); toast({...})`),
 * exportamos un `toast()` con la MISMA firma legacy `{ title, description,
 * variant }` que internamente delega en `sonner`.
 *
 * Para código nuevo, prefiere los helpers `notifyError / notifySuccess /
 * notifyWarning` de `@/components/shared/utils/appFeedback` o `import { toast } from "sonner"`
 * directamente.
 */
import { toast as sonnerToast } from "sonner";
import type { ReactNode } from "react";
import { openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import type { ErrorReport } from "@/components/shared/utils/errorReport";

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
