import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/ui/brand";
import librecargaLogo from "@/assets/librecarga-logo.png";

type Variant = "icon" | "horizontal" | "stacked";
type Size = "sm" | "md" | "lg";

interface BrandLockupProps {
  variant?: Variant;
  size?: Size;
  /** Texto secundario debajo del wordmark (org name, "Super Admin", "Portal de Cliente"…) */
  subtitle?: string;
  /** Si true, oculta el wordmark y solo muestra el isotipo (útil en sidebar colapsado) */
  iconOnly?: boolean;
  className?: string;
}

const ICON_SIZE: Record<Size, string> = {
  sm: "h-9 w-9",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

const WORDMARK_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

const ICON_PADDING: Record<Size, string> = {
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2",
};

/**
 * Lockup de marca unificado para Libre Carga.
 * Centraliza el tratamiento del isotipo + wordmark en login, sidebar, portal y admin.
 *
 * - `icon`        — solo isotipo en contenedor con fondo blanco constante (light + dark).
 * - `horizontal`  — isotipo + wordmark al costado, opcional subtitle.
 * - `stacked`     — isotipo arriba, wordmark + subtitle centrados (login).
 */
export function BrandLockup({
  variant = "horizontal",
  size = "sm",
  subtitle,
  iconOnly = false,
  className,
}: BrandLockupProps) {
  const icon = (
    <div
      className={cn(
        "rounded-xl bg-white ring-1 ring-border/40 shadow-sm shrink-0 flex items-center justify-center overflow-hidden",
        ICON_SIZE[size],
        ICON_PADDING[size],
      )}
    >
      <img
        src={librecargaLogo}
        alt={`${BRAND.name} logo`}
        className="h-full w-full object-contain"
      />
    </div>
  );

  if (variant === "icon" || iconOnly) {
    return <div className={cn("flex items-center justify-center", className)}>{icon}</div>;
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
        {icon}
        <div className="space-y-0.5">
          <div
            className={cn(
              "font-bold tracking-tight text-foreground leading-none",
              WORDMARK_SIZE[size],
            )}
          >
            {BRAND.name}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
    );
  }

  // horizontal
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      {icon}
      <div className="flex flex-col min-w-0 leading-tight">
        <span
          className={cn(
            "font-bold tracking-tight text-foreground truncate",
            WORDMARK_SIZE[size],
          )}
        >
          {BRAND.name}
        </span>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
