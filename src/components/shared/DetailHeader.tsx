import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailHeaderProps {
  /**
   * Ruta destino del botón Volver. Si es número, hace `navigate(n)` (ej. -1).
   * Si es una función (ver `useVolver`), se invoca directamente al hacer clic:
   * úsala para volver al historial cuando el usuario navegó desde dentro de la
   * app (conserva filtros/pestaña de origen) con una ruta de respaldo.
   * Usa `null` en páginas públicas sin página padre (portal, tracking) para
   * ocultar el botón por completo y conservar sólo título + badge + acciones.
   */
  backTo?: string | number | null | (() => void);
  /** Label accesible del botón Volver. */
  backLabel?: string;

  /** Icono opcional a la izquierda del título. */
  icon?: ReactNode;
  /** Título principal (<h1>). */
  title: ReactNode;
  /** Nivel semántico del título. Usa `h2` cuando la página ya tiene un `h1`. */
  titleAs?: "h1" | "h2";
  /** Subtítulo/descripción bajo el título. */
  subtitle?: ReactNode;
  /** Badge/status a la derecha del título (misma línea en md+). */
  badge?: ReactNode;
  /** Chips/metadatos secundarios bajo el subtítulo. */
  meta?: ReactNode;
  /** Acciones (botones, menús) alineadas a la derecha. */
  trailing?: ReactNode;
  /** Tabs opcionales al pie del encabezado — full-width. */
  tabs?: ReactNode;
  className?: string;
}


/**
 * Encabezado de página de detalle: botón Volver + título + badge + acciones.
 *
 * Complementa a `PageHeader` (que es para listados). Úsalo en páginas de detalle
 * como Factura, Proforma, Cliente, Proveedor, PortalEmbarque, PortalFactura.
 *
 * Notas de implementación (auditoría visual v13.320.69):
 *  - Cuando `backTo` es una ruta, el botón se renderiza como `<a>` real (Link),
 *    de modo que funcione clic-medio / abrir en pestaña nueva.
 *  - El icono vive fuera del contenedor que envuelve, así nunca cae a su propia
 *    línea cuando el título es largo (caso Cliente con razón social completa).
 *  - El título usa `line-clamp-2 break-words` + `title` nativo: se leen hasta dos
 *    líneas y el texto completo queda disponible en tooltip.
 *  - `titleAs` permite degradar a `h2` en páginas que ya tienen un `h1` (CRM).
 *  - En móvil las acciones se alinean a la izquierda; sólo en `lg+` van a la derecha.
 */
export function DetailHeader({
  backTo = -1,
  backLabel = "Volver",
  icon,
  title,
  titleAs: TitleTag = "h1",
  subtitle,
  badge,
  meta,
  trailing,
  tabs,
  className,
}: DetailHeaderProps) {
  const navigate = useNavigate();
  const backClasses = "-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground";

  return (
    <div className={cn("space-y-3", className)}>
      {backTo === null ? null : typeof backTo === "string" ? (
        <Button variant="ghost" size="sm" className={backClasses} asChild>
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {backLabel}
          </Link>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (typeof backTo === "function" ? backTo() : navigate(backTo))}
          className={backClasses}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel}
        </Button>
      )}


      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {icon ? <span className="mt-0.5 shrink-0 leading-none">{icon}</span> : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <TitleTag
                className="min-w-0 break-words text-display font-bold tracking-tight line-clamp-2"
                title={typeof title === "string" ? title : undefined}
              >
                {title}
              </TitleTag>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
            ) : null}
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
        </div>
        {trailing ? (
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap lg:justify-end">
            {trailing}
          </div>
        ) : null}
      </div>

      {tabs ? <div className="pt-1">{tabs}</div> : null}
    </div>
  );
}
