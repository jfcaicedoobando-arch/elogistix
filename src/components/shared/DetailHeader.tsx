import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailHeaderProps {
  /** Ruta destino del botón Volver. Si es número, hace `navigate(n)` (ej. -1). */
  backTo?: string | number;
  /** Label accesible del botón Volver. */
  backLabel?: string;
  /** Icono opcional a la izquierda del título. */
  icon?: ReactNode;
  /** Título principal (<h1>). */
  title: ReactNode;
  /** Subtítulo/descripción bajo el título. */
  subtitle?: ReactNode;
  /** Badge/status a la derecha del título (misma línea en md+). */
  badge?: ReactNode;
  /** Acciones (botones, menús) alineadas a la derecha. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Encabezado de página de detalle: botón Volver + título + badge + acciones.
 *
 * Complementa a `PageHeader` (que es para listados). Úsalo en páginas de detalle
 * como Factura, Proforma, Cliente, Proveedor, PortalEmbarque, PortalFactura.
 */
export function DetailHeader({
  backTo = -1,
  backLabel = "Volver",
  icon,
  title,
  subtitle,
  badge,
  trailing,
  className,
}: DetailHeaderProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (typeof backTo === "number") navigate(backTo);
    else navigate(backTo);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {backLabel}
      </Button>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {icon}
            <h1 className="text-display font-bold tracking-tight truncate">{title}</h1>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto md:flex-nowrap">
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}
