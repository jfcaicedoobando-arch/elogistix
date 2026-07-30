/**
 * Shell único de las páginas de detalle de documentos financieros
 * (factura emitida, factura de proveedor y proforma).
 *
 * Fija la anatomía compartida — encabezado → cinta de KPIs → avisos →
 * pestañas + riel de historial — para que las tres pantallas se lean igual
 * a 1366×768 y en pantallas mayores.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DocumentoKpiStrip } from "@/components/shared/documento/DocumentoKpiStrip";
import { DocumentoLayout } from "@/components/shared/documento/DocumentoLayout";
import type { DocumentoKpi } from "@/lib/domain/documentoKpis";

interface Props {
  /** Encabezado del documento (normalmente un `DetailHeader`). */
  header: ReactNode;
  /** Métricas del documento; si va vacío no se renderiza la cinta. */
  kpis?: DocumentoKpi[];
  /** Avisos contextuales (banners) entre los KPIs y el contenido. */
  banners?: ReactNode;
  /** Columna derecha: historial y actividad. */
  rail?: ReactNode;
  /** Cuerpo principal: normalmente `DocumentoTabs`. */
  children: ReactNode;
  className?: string;
}

export function DocumentoDetalleShell({
  header, kpis, banners, rail, children, className,
}: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      {header}
      {kpis && kpis.length > 0 ? <DocumentoKpiStrip kpis={kpis} /> : null}
      {banners}
      <DocumentoLayout rail={rail}>{children}</DocumentoLayout>
    </div>
  );
}
