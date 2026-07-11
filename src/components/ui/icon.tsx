import { forwardRef, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Props que cualquier ícono lucide-react acepta.
 * Copiamos el shape mínimo para no depender del tipo `LucideProps`
 * (que cambió entre 0.x y 1.x).
 */
type LucideLikeProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  color?: string;
};

export interface IconProps extends Omit<LucideLikeProps, "ref"> {
  /** Componente de ícono lucide (o compatible) a renderizar. */
  as: ComponentType<LucideLikeProps>;
  /**
   * Etiqueta accesible. Si se pasa, el ícono se expone a screen readers.
   * Si se omite, se marca `aria-hidden` (ícono decorativo).
   */
  label?: string;
  /** Tamaño en px. Default 16 para consistencia con el design system. */
  size?: number;
  /** Grosor de trazo. Default 2 (mismo default de lucide). */
  strokeWidth?: number;
}

/**
 * Wrapper estándar de proyecto sobre lucide-react.
 * — Fija defaults (`size=16`, `strokeWidth=2`).
 * — Aplica `aria-label` o `aria-hidden` según semántica.
 * — Permite componer clases con Tailwind (`className`).
 *
 * Uso:
 * ```tsx
 * import { Truck } from "lucide-react";
 * <Icon as={Truck} label="Envío en tránsito" />
 * <Icon as={Truck} className="text-primary" /> // decorativo
 * ```
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { as: Component, label, size = 16, strokeWidth = 2, className, ...rest },
  ref,
) {
  const a11yProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const, focusable: false as const };
  return (
    <Component
      ref={ref}
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      {...a11yProps}
      {...rest}
    />
  );
});
