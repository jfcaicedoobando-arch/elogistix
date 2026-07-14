import { forwardRef } from "react";
import { Anchor, Plane, Truck, Shuffle, Package, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModoIconProps {
  modo: string;
  className?: string;
  size?: number;
  /** Si true, envuelve en un círculo coloreado por modo */
  circle?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  "Marítimo": Anchor,
  "Aéreo": Plane,
  "Terrestre": Truck,
  "Multimodal": Shuffle,
};

const COLOR_MAP: Record<string, string> = {
  "Marítimo": "text-info",
  "Aéreo": "text-mode-aereo",
  "Terrestre": "text-warning",
  "Multimodal": "text-mode-multimodal",
};

const CIRCLE_BG: Record<string, string> = {
  "Marítimo": "bg-info/10",
  "Aéreo": "bg-mode-aereo-soft",
  "Terrestre": "bg-warning/10",
  "Multimodal": "bg-mode-multimodal-soft",
};

/**
 * Icono Lucide para el modo de transporte.
 * Reemplaza los emojis 🚢 ✈️ 🚛 🔄 por iconografía consistente.
 * forwardRef para que DataTable / Tooltip puedan adjuntar refs sin warnings.
 */
export const ModoIcon = forwardRef<HTMLSpanElement, ModoIconProps>(
  ({ modo, className, size = 16, circle = false }, ref) => {
    const Icon = ICON_MAP[modo] ?? Package;
    const color = COLOR_MAP[modo] ?? "text-muted-foreground";

    if (circle) {
      const bg = CIRCLE_BG[modo] ?? "bg-muted";
      return (
        <span
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            bg,
            className,
          )}
          style={{ width: size + 12, height: size + 12 }}
          aria-label={modo}
        >
          <Icon className={color} size={size} />
        </span>
      );
    }

    return (
      <span ref={ref} className="inline-flex" aria-label={modo}>
        <Icon className={cn(color, className)} size={size} />
      </span>
    );
  },
);
ModoIcon.displayName = "ModoIcon";

