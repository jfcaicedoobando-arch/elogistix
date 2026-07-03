import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DollarSign, Eye, Stamp, Ban } from "lucide-react";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatDate } from "@/lib/formatters";
import {
  statusColumn,
  clientColumn,
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
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
      meta: { width: "w-[140px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => {
        const numero = row.original.numero ?? "";
        const esBorradorSinFolio = numero.startsWith("BORRADOR-");
        return (
          <Link
            to={`/facturacion/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-accent hover:underline"
          >
            {esBorradorSinFolio
              ? <span className="text-muted-foreground italic">Sin folio (borrador)</span>
              : numero}
          </Link>
        );
      },
    },
    {
      id: "expediente", header: "Expediente",
      meta: { width: "w-[110px]", className: "whitespace-nowrap" },
      cell: ({ row }) => row.original.expediente,
    },
    {
      id: "proforma", header: "Proforma",
      meta: { width: "w-[140px]", className: "text-xs whitespace-nowrap" },
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
    dateColumn<Factura>({
      id: "emision",
      header: "Emisión",
      accessor: (f) => f.fecha_emision,
    }),
    {
      id: "vencimiento", header: "Vencimiento",
      accessorFn: (f) => f.fecha_vencimiento, enableSorting: true,
      sortingFn: sortByDate<Factura>((f) => f.fecha_vencimiento),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
    },
    statusColumn<Factura>({
      id: "estado",
      header: "Estado",
      domain: "factura",
      accessor: (f) => f.estado,
    }),
    {
      id: "archivos", header: "Archivos",
      meta: { width: "w-[110px]" },
      cell: ({ row }) => {
        const f = row.original;
        const timbrada = !!(f as { uuid_fiscal?: string | null }).uuid_fiscal;
        if (!f.factura_pdf_url && !f.factura_xml_url && !timbrada) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <div className="flex items-center gap-1">
            <FacturaDownloadButton stored={f.factura_pdf_url ?? null} kind="pdf" facturaId={f.id} />
            <FacturaDownloadButton stored={f.factura_xml_url ?? null} kind="xml" facturaId={f.id} />
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
            <Button variant="ghost" size="icon" onClick={() => onVerPagos(f)} title="Ver pagos" aria-label="Ver pagos">
              <Eye className="h-4 w-4" />
            </Button>
            {cancelable && (
              <Button variant="ghost" size="icon" onClick={() => onCancelar!(f)} title="Cancelar CFDI" aria-label="Cancelar CFDI" className="text-destructive">
                <Ban className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ]);
}
