import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Fragment, memo, useMemo } from "react";
import { useBreadcrumbLabels } from "@/lib/contexts/BreadcrumbContext";

/**
 * Mapa de segmentos de ruta → etiqueta visible.
 * Para segmentos dinámicos (ids/uuids/expedientes), se muestran tal cual
 * truncados; el detalle de la entidad se mostrará en el header de la página
 * (no es responsabilidad del breadcrumb resolver el nombre).
 */
const SEGMENT_LABELS: Record<string, string> = {
  "": "Inicio",
  inicio: "Inicio",
  embarques: "Embarques",
  cotizaciones: "Cotizaciones",
  clientes: "Clientes",
  proveedores: "Proveedores",
  compras: "Compras",
  agentes: "Agentes",
  facturacion: "Facturación",
  proformas: "Proformas",
  cartera: "Cartera",
  operaciones: "Operaciones",

  reportes: "Reportes",
  rentabilidad: "Rentabilidad",
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
  // CRM
  crm: "CRM",
  "mi-dia": "Mi día",
  leads: "Leads",
  oportunidades: "Oportunidades",
  actividades: "Actividades",
  analitica: "Analítica",
  // Profit / finanzas
  profit: "Profit",
  dashboard: "Dashboard",
  ejecutivo: "Ejecutivo",
  "estado-resultados": "Estado de Resultados",
  proyeccion: "Proyección",
  presupuesto: "Presupuesto",
  comisiones: "Comisiones",
  // Tesorería / CxP
  tesoreria: "Tesorería",
  cuentas: "Cuentas",
  flujo: "Flujo",
  cxp: "CxP",
  // Costeo
  costeo: "Costeo",
  rutas: "Rutas",
  tarifas: "Tarifas",
  buscar: "Buscar",
  buzon: "Buzón",
  "demoras-venta": "Demoras / Venta",
  // Catálogos / dev
  catalogos: "Catálogos",
  navieras: "Navieras",
  puertos: "Puertos",
  contenedores: "Contenedores",
  dev: "Dev",
  diagnostico: "Diagnóstico",
  papelera: "Papelera",
  planes: "Planes",
  idempotencia: "Idempotencia",
  auditoria: "Auditoría",
  ayuda: "Ayuda",
  sentry: "Sentry",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Trunca segmentos largos (uuids, expedientes) para que el breadcrumb
 * no rompa el layout. Mantiene los primeros 14 caracteres.
 * Aplica Title Case a segmentos alfabéticos (p.ej. "compras" → "Compras")
 * para homogeneizar con `SEGMENT_LABELS`. Deja intactos códigos con dígitos
 * o guiones porque suelen ser identificadores (expedientes, refs).
 */
function formatDynamicSegment(seg: string): string {
  const hasDigits = /\d/.test(seg);
  const looksAlpha = /^[a-záéíóúñü-]+$/i.test(seg);
  if (looksAlpha && !hasDigits) {
    // Title Case simple respetando guiones ("mi-dia" → "Mi-Dia" no aplica; sólo tokens alfa puros).
    const lower = seg.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
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
      // Para UUIDs aún no resueltos, mostrar "…" en vez del UUID truncado
      // (evita el flash visual de "009ba3b0-ab4b-…" mientras carga el detalle).
      const fallback = UUID_RE.test(part) ? "…" : formatDynamicSegment(part);
      return {
        label: known ?? dynamic ?? fallback,
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
