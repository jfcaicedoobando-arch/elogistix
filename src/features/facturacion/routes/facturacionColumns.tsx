
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatDate, formatFechaHora } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MailCheck } from "lucide-react";
import {
  statusColumn,
  clientColumn,
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import type { useFacturas } from "@/features/facturacion/hooks";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { deriveFacturaBadgeEstado } from "@/features/facturacion/domain/facturaBadgeEstado";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export type Factura = ReturnType<typeof useFacturas>["data"] extends (infer U)[] | undefined ? U : never;

/**
 * Columnas de la lista de facturación.
 *
 * v13.172.12: se retira la columna "Acciones". Timbrar, Registrar pago,
 * Ver pagos y Cancelar CFDI viven ahora exclusivamente en el detalle
 * (`/facturacion/:id`) para evitar operaciones destructivas o fiscales
 * desde una vista de listado con poco contexto.
 */
export function buildFacturaColumns(): ColumnDef<Factura, unknown>[] {
  return defineColumns<Factura>([
    {
      id: "numero", header: "# Factura",
      accessorFn: (f) => f.numero, enableSorting: true,
      sortingFn: sortByString<Factura>((f) => f.numero),
      meta: { width: COL_W.monto, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => {
        const numero = row.original.numero ?? "";
        const esBorradorSinFolio = numero.startsWith("BORRADOR-");
        const enviadaAt = (row.original as { enviada_cliente_at?: string | null }).enviada_cliente_at ?? null;
        return (
          <div className="flex items-center gap-1.5">
            {esBorradorSinFolio
              ? <span className="text-muted-foreground italic">Sin folio (borrador)</span>
              : <span>{numero}</span>}
            <AmbienteBadge ambiente={row.original.ambiente} />
            {enviadaAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 border-success/40 text-success h-5 px-1.5">
                    <MailCheck className="h-3 w-3" />
                    <span className="text-2xs">Enviada</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Enviada al cliente · {formatFechaHora(enviadaAt)}</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      id: "expediente", header: "Expediente",
      // Oculto en tableta (<xl) — visible desde el # Factura sticky y detalle.
      meta: { width: COL_W.fecha, className: "whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.expediente,
    },
    {
      id: "proforma", header: "Proforma",
      // Oculto en tableta (<xl).
      meta: { width: COL_W.monto, className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.proformas?.numero
        ? <span className="font-mono">{row.original.proformas.numero}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    clientColumn<Factura>({
      id: "cliente",
      header: "Cliente",
      accessor: (f) => f.cliente_nombre,
    }),
    moneyColumn<Factura>({
      id: "monto",
      header: "Monto",
      accessor: (f) => f.total,
      currencyAccessor: (f) => f.moneda,
    }),
    {
      ...dateColumn<Factura>({ id: "emision", header: "Emisión", accessor: (f) => f.fecha_emision }),
      meta: { width: COL_W.fecha, className: "whitespace-nowrap" },
    },
    {
      id: "vencimiento", header: "Vencimiento",
      accessorFn: (f) => f.fecha_vencimiento, enableSorting: true,
      sortingFn: sortByDate<Factura>((f) => f.fecha_vencimiento),
      // Oculto en tableta (<xl).
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
    },
    statusColumn<Factura>({
      id: "estado",
      header: "Estado",
      domain: "factura",
      accessor: (f) => deriveFacturaBadgeEstado(
        f.estado,
        (f as { acuse_cancelacion_status?: string | null }).acuse_cancelacion_status ?? null,
        (f as { cancellation_status?: string | null }).cancellation_status ?? null,
      ),
    }),
    {
      id: "archivos", header: "Archivos",
      // QW4 Tanda 1 — visible desde tableta (>=lg) para descarga rápida.
      meta: { width: COL_W.fecha, className: "hidden lg:table-cell", headerClassName: "hidden lg:table-cell" },
      cell: ({ row }) => {
        const f = row.original;
        const timbrada = !!(f as { uuid_fiscal?: string | null }).uuid_fiscal;
        if (!f.factura_pdf_url && !f.factura_xml_url && !timbrada) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <FacturaDownloadButton stored={f.factura_pdf_url ?? null} kind="pdf" facturaId={f.id} />
            <FacturaDownloadButton stored={f.factura_xml_url ?? null} kind="xml" facturaId={f.id} />
          </div>
        );
      },
    },
  ]);
}
