import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Eye, Stamp, Ban } from "lucide-react";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { useFacturas } from "@/features/facturacion/hooks";

export type Factura = ReturnType<typeof useFacturas>["data"] extends (infer U)[] | undefined ? U : never;

export interface FacturaColumnsOptions {
  canEdit: boolean;
  onRegistrarPago: (f: Factura) => void;
  onVerPagos: (f: Factura) => void;
  onTimbrar?: (f: Factura) => void;
  onCancelar?: (f: Factura) => void;
}

const ESTADOS_PAGABLES = new Set(["Emitida", "Vencida", "Parcialmente pagada"]);
const ESTADOS_TIMBRABLES = new Set(["Borrador", "Por timbrar"]);

export function buildFacturaColumns(opts: FacturaColumnsOptions): ColumnDef<Factura, unknown>[] {
  const { canEdit, onRegistrarPago, onVerPagos, onTimbrar, onCancelar } = opts;
  return defineColumns<Factura>([
    {
      id: "numero", header: "# Factura",
      accessorFn: (f) => f.numero, enableSorting: true,
      sortingFn: sortByString<Factura>((f) => f.numero),
      meta: { width: "w-[110px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => (
        <Link
          to={`/facturacion/${row.original.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-accent hover:underline"
        >
          {row.original.numero}
        </Link>
      ),
    },
    { id: "expediente", header: "Expediente", meta: { width: "w-[110px]", className: "whitespace-nowrap" }, cell: ({ row }) => row.original.expediente },
    {
      id: "proforma", header: "Proforma",
      meta: { width: "w-[140px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.proformas?.numero
        ? <span className="font-mono">{row.original.proformas.numero}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "cliente", header: "Cliente",
      meta: { width: "min-w-[160px]", className: "max-w-[200px] truncate" },
      cell: ({ row }) => <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>,
    },
    {
      id: "monto", header: "Monto",
      accessorFn: (f) => f.total, enableSorting: true,
      sortingFn: sortByNumber<Factura>((f) => f.total),
      meta: { width: "w-[130px]", align: "right", className: "font-medium whitespace-nowrap tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda),
    },
    {
      id: "emision", header: "Emisión",
      accessorFn: (f) => f.fecha_emision, enableSorting: true,
      sortingFn: sortByDate<Factura>((f) => f.fecha_emision),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.fecha_emision),
    },
    {
      id: "vencimiento", header: "Vencimiento",
      accessorFn: (f) => f.fecha_vencimiento, enableSorting: true,
      sortingFn: sortByDate<Factura>((f) => f.fecha_vencimiento),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
    },
    {
      id: "estado", header: "Estado",
      accessorFn: (f) => f.estado, enableSorting: true,
      sortingFn: sortByString<Factura>((f) => f.estado),
      meta: { width: "w-[120px]" },
      cell: ({ row }) => <Badge className={getEstadoColor(row.original.estado)}>{row.original.estado}</Badge>,
    },
    {
      id: "archivos", header: "Archivos",
      meta: { width: "w-[110px]" },
      cell: ({ row }) => {
        const f = row.original;
        if (!f.factura_pdf_url && !f.factura_xml_url) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex items-center gap-1">
            {f.factura_pdf_url && <FacturaDownloadButton stored={f.factura_pdf_url} kind="pdf" />}
            {f.factura_xml_url && <FacturaDownloadButton stored={f.factura_xml_url} kind="xml" />}
          </div>
        );
      },
    },
    {
      id: "acciones", header: "Acciones",
      meta: { width: "w-[200px]" },
      cell: ({ row }) => {
        const f = row.original;
        const pagable = canEdit && ESTADOS_PAGABLES.has(f.estado);
        const timbrable = canEdit && onTimbrar && ESTADOS_TIMBRABLES.has(f.estado);
        const cancelable = canEdit && onCancelar && f.estado === "Emitida";
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {timbrable && (
              <Button variant="default" size="sm" onClick={() => onTimbrar!(f)} title="Timbrar CFDI">
                <Stamp className="h-3.5 w-3.5 mr-1" /> Timbrar
              </Button>
            )}
            {pagable && (
              <Button variant="outline" size="sm" onClick={() => onRegistrarPago(f)} title="Registrar pago">
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Pagar
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onVerPagos(f)} title="Ver pagos">
              <Eye className="h-4 w-4" />
            </Button>
            {cancelable && (
              <Button variant="ghost" size="icon" onClick={() => onCancelar!(f)} title="Cancelar CFDI" className="text-destructive">
                <Ban className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ]);
}

