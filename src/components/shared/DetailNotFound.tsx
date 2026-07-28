import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { DetailHeader } from "@/components/shared/DetailHeader";
import EmptyState from "@/components/empty/EmptyState";

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
 * Auditoría visual v13.320.70: varias rutas de detalle (Cotización, Embarque,
 * Cliente, Factura) mostraban sólo un texto centrado, sin encabezado ni botón
 * Volver, dejando al usuario sin salida más que el botón del navegador.
 * Este componente garantiza que el encabezado (y por tanto la navegación de
 * retorno) exista también en el camino de error.
 */
export function DetailNotFound({
  icon,
  title,
  description,
  backTo,
  backLabel,
  withContainer = true,
}: DetailNotFoundProps) {
  const navigate = useNavigate();

  const content = (
    <div className="space-y-2">
      <DetailHeader backTo={backTo} backLabel={backLabel} title={title} />
      <EmptyState
        icon={icon}
        title={title}
        description={description ?? "El registro no existe, fue eliminado o no tienes permiso para verlo."}
        primaryAction={{ label: backLabel, onClick: () => navigate(backTo) }}
      />
    </div>
  );

  return withContainer ? <PageContainer>{content}</PageContainer> : content;
}
