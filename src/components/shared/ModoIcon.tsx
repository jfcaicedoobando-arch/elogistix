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
  "Marítimo": "text-blue-600 dark:text-blue-400",
  "Aéreo": "text-sky-600 dark:text-sky-400",
  "Terrestre": "text-amber-600 dark:text-amber-400",
  "Multimodal": "text-purple-600 dark:text-purple-400",
};

const CIRCLE_BG: Record<string, string> = {
  "Marítimo": "bg-blue-100 dark:bg-blue-900/40",
  "Aéreo": "bg-sky-100 dark:bg-sky-900/40",
  "Terrestre": "bg-amber-100 dark:bg-amber-900/40",
  "Multimodal": "bg-purple-100 dark:bg-purple-900/40",
};

/**
 * Icono Lucide para el modo de transporte.
 * Reemplaza los emojis 🚢 ✈️ 🚛 🔄 por iconografía consistente.
 */
export function ModoIcon({ modo, className, size = 16, circle = false }: ModoIconProps) {
  const Icon = ICON_MAP[modo] ?? Package;
  const color = COLOR_MAP[modo] ?? "text-muted-foreground";

  if (circle) {
    const bg = CIRCLE_BG[modo] ?? "bg-muted";
    return (
      <span
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

  return <Icon className={cn(color, className)} size={size} aria-label={modo} />;
}
