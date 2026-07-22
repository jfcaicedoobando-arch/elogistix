/**
 * `<ToneBadge>` — Chip neutro con dot de color, patrón oficial del módulo CxP.
 *
 * v13.307.19 · Extraído para que todos los badges del módulo (facturas,
 * notas de crédito, aging, conciliación, por-pagar, eliminación) hablen
 * el mismo lenguaje visual: fondo `bg-muted`, texto muted, dot de 6 px
 * indicando severidad. Ver `src/features/cxp/lib/badgeTone.ts`.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CHIP_BASE, CHIP_BASE_MD, TONE_DOT, type ChipTone } from "@/features/cxp/lib/badgeTone";

interface ToneBadgeProps {
  tone: ChipTone;
  children: React.ReactNode;
  /** `sm` (h-4, default) para celdas densas; `md` (h-5) para columnas de datos. */
  size?: "sm" | "md";
  /** Muestra el dot (default true). */
  withDot?: boolean;
  className?: string;
  title?: string;
}

export function ToneBadge({
  tone,
  children,
  size = "sm",
  withDot = true,
  className,
  title,
}: ToneBadgeProps) {
  const base = size === "md" ? CHIP_BASE_MD : CHIP_BASE;
  return (
    <Badge variant="outline" className={cn(base, className)} title={title}>
      {withDot && (
        <span
          aria-hidden
          className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", TONE_DOT[tone])}
        />
      )}
      <span className="tabular-nums whitespace-nowrap">{children}</span>
    </Badge>
  );
}
