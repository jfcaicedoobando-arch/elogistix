import { cn } from "@/lib/utils";

interface Props {
  children: string;
  /** Contador; se oculta cuando es 0 o undefined. */
  count?: number;
  /** `warning` para contadores que representan pendientes por atender. */
  tone?: "neutral" | "warning";
}

const TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-warning/15 text-warning",
} as const;

/**
 * Etiqueta canónica de un `TabsTrigger` en fichas de detalle: texto + pill
 * de contador. Homologa el detalle de cliente (que usaba `Nombre (12)` en
 * texto plano) con el de proveedor (que sólo pintaba el pill en una pestaña).
 */
export function DetailTabLabel({ children, count, tone = "neutral" }: Props) {
  return (
    <span className="flex items-center gap-1.5">
      {children}
      {typeof count === "number" && count > 0 ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-2xs font-medium tabular-nums",
            TONE_CLASSES[tone],
          )}
        >
          {count}
        </span>
      ) : null}
    </span>
  );
}
