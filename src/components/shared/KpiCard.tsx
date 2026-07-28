import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { KpiBodyChip, KpiBodyInline, type KpiBodyProps } from "./KpiCardBody";
import {
  kpiVariantStyles,
  type KpiDeltaVariant,
  type KpiIconVariant,
  type KpiVariant,
} from "./kpiCard.tokens";

export type { KpiVariant,  } from "./kpiCard.tokens";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaVariant?: KpiDeltaVariant;
  icon?: LucideIcon;
  variant?: KpiVariant;
  /** Presentación del icono. `inline` (default) = a la derecha sin fondo.
   *  `chip` = a la izquierda, con fondo pastel tintado según variant. */
  iconVariant?: KpiIconVariant;
  sublabel?: string;
  /** Tooltip nativo sobre el valor. Útil cuando el valor viene en notación
   *  compacta (p.ej. "USD 1.2M") y se quiere mostrar el valor completo. */
  valueTooltip?: string;
  onClick?: () => void;
  /** Si se pasa, la card se envuelve en un `<Link to={...}>` (react-router). */
  to?: string;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Tarjeta KPI canónica: label, valor, delta opcional, icono y variante semántica.
 *
 * v13.302.3: agregado `iconVariant="chip"`, `valueTooltip`, `children` y
 * variants `accent`/`secondary` para absorber el clon de `features/operaciones`.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaVariant = "neutral",
  icon: Icon,
  variant = "default",
  iconVariant = "inline",
  sublabel,
  valueTooltip,
  onClick,
  to,
  loading = false,
  className,
  children,
}: KpiCardProps) {
  const valueStr = String(value ?? "");
  const interactive = Boolean(onClick) && !to;

  const bodyProps: KpiBodyProps = {
    label, value, valueStr, loading, delta, deltaVariant, sublabel,
    Icon, variant, iconVariant, valueTooltip, children,
  };

  const card = (
    <Card
      className={cn(
        "transition-shadow h-full",
        kpiVariantStyles[variant],
        (onClick || to) && "cursor-pointer hover:shadow-raised",
        className,
      )}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {iconVariant === "chip" ? <KpiBodyChip {...bodyProps} /> : <KpiBodyInline {...bodyProps} />}
    </Card>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
      >
        {card}
      </Link>
    );
  }
  return card;
}
