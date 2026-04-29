import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Fragment, memo, useMemo } from "react";
import { useBreadcrumbLabels } from "@/contexts/BreadcrumbContext";

/**
 * Mapa de segmentos de ruta → etiqueta visible.
 * Para segmentos dinámicos (ids/uuids/expedientes), se muestran tal cual
 * truncados; el detalle de la entidad se mostrará en el header de la página
 * (no es responsabilidad del breadcrumb resolver el nombre).
 */
const SEGMENT_LABELS: Record<string, string> = {
  "": "Inicio",
  embarques: "Embarques",
  cotizaciones: "Cotizaciones",
  clientes: "Clientes",
  proveedores: "Proveedores",
  facturacion: "Pre-Facturación",
  operaciones: "Operaciones",
  reportes: "Reportes",
  rentabilidad: "Rentabilidad",
  changelog: "Changelog",
  bitacora: "Bitácora",
  usuarios: "Usuarios",
  configuracion: "Configuración",
  admin: "Admin",
  organizaciones: "Organizaciones",
  portal: "Portal",
  facturas: "Facturas",
  nuevo: "Nuevo",
  nueva: "Nueva",
  editar: "Editar",
};

/**
 * Trunca segmentos largos (uuids, expedientes) para que el breadcrumb
 * no rompa el layout. Mantiene los primeros 14 caracteres.
 */
function formatDynamicSegment(seg: string): string {
  if (seg.length <= 18) return seg;
  return `${seg.slice(0, 14)}…`;
}

interface Crumb {
  label: string;
  to: string;
  isLast: boolean;
}

function BreadcrumbsBase() {
  const { pathname } = useLocation();
  const dynamicLabels = useBreadcrumbLabels();

  const crumbs: Crumb[] = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      return [{ label: "Inicio", to: "/", isLast: true }];
    }
    let acc = "";
    return parts.map((part, i) => {
      acc += `/${part}`;
      const known = SEGMENT_LABELS[part];
      const dynamic = dynamicLabels[part];
      return {
        label: known ?? dynamic ?? formatDynamicSegment(part),
        to: acc,
        isLast: i === parts.length - 1,
      };
    });
  }, [pathname, dynamicLabels]);

  return (
    <nav aria-label="Migas de pan" className="min-w-0 flex-1">
      <ol className="flex items-center gap-1.5 text-sm overflow-hidden">
        {crumbs.map((c, i) => (
          <Fragment key={`${c.to}-${i}`}>
            {i > 0 && (
              <ChevronRight
                aria-hidden
                className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0"
              />
            )}
            {c.isLast ? (
              <span
                className="font-medium text-foreground truncate"
                aria-current="page"
                title={c.label}
              >
                {c.label}
              </span>
            ) : (
              <Link
                to={c.to}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
                title={c.label}
              >
                {c.label}
              </Link>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

export const Breadcrumbs = memo(BreadcrumbsBase);
