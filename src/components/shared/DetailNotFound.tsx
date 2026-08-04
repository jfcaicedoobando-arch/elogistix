import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { useVolver } from "@/hooks/shared/useVolver";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { Button } from "@/components/ui/button";

export interface DetailNotFoundProps {
  /** Icono del estado vacío (ej. `PackageX`, `FileX`). */
  icon: LucideIcon;
  /** Título del estado, ej. "Cotización no encontrada". */
  title: string;
  /** Explicación de por qué no se encontró. */
  description?: string;
  /** Ruta del listado padre — se usa en el botón Volver del encabezado y del estado vacío. */
  backTo: string;
  /** Etiqueta canónica del botón Volver, ej. "Volver a Cotizaciones". */
  backLabel: string;
  /** Envuelve en `PageContainer`. Desactívalo cuando la página ya provee el contenedor. */
  withContainer?: boolean;
}

/**
 * Estado "no encontrado" canónico de las páginas de detalle.
 *
 * Auditoría visual v13.320.71: varias rutas de detalle (Cotización, Embarque,
 * Cliente, Factura) mostraban sólo un texto centrado, sin encabezado ni botón
 * Volver, dejando al usuario sin salida más que el botón del navegador.
 * Este componente garantiza que el encabezado (y por tanto la navegación de
 * retorno) exista también en el camino de error.
 */
export function DetailNotFound({
  icon: Icon,
  title,
  description,
  backTo,
  backLabel,
  withContainer = true,
}: DetailNotFoundProps) {
  const volver = useVolver(backTo);
  const content = (
    <div className="space-y-2">
      <DetailHeader backTo={volver} backLabel={backLabel} title={title} />
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          {description ?? "El registro no existe, fue eliminado o no tienes permiso para verlo."}
        </p>
        <Button asChild>
          <Link to={backTo}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );

  return withContainer ? <PageContainer>{content}</PageContainer> : content;
}
