import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  statusColumn,
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

// Estado del flujo de aprobación (dominio `aprobacion_cxp` en statusRegistry).
type EstadoAprob = "pendiente" | "aprobada" | "rechazada";
const APROB_STATUS: Record<EstadoAprob, string> = {
  pendiente: "Por aprobar",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export function buildCxPColumns(): ColumnDef<FacturaCxP, unknown>[] {
  return defineColumns<FacturaCxP>([
    {
      id: "folio_interno", header: "Folio",
      accessorFn: (f) => f.folio_interno, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.folio_interno),
      meta: { width: "w-[95px]", className: "font-mono text-xs font-semibold whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.folio_interno,
    },
    {
      id: "folio", header: "Folio prov.",
      accessorFn: (f) => f.folio_proveedor, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.folio_proveedor),
      // Ocultada en tableta (<xl) para eliminar scroll horizontal en /cxp.
      meta: { width: "w-[120px]", className: "whitespace-nowrap text-xs text-muted-foreground hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.folio_proveedor,
    },
    {
      id: "proveedor", header: "Proveedor",
      meta: { width: "min-w-[160px]", className: "max-w-[220px]" },
      cell: ({ row }) => {
        const origen = row.original.proveedor_origen;
        const badgeCls = origen === "Nacional"
          ? "bg-primary/10 text-primary border-primary/20"
          : origen === "Extranjero"
            ? "bg-warning/10 text-warning border-warning/20"
            : "";
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="truncate" title={toTitleCase(row.original.proveedor_nombre)}>
              {toTitleCase(row.original.proveedor_nombre)}
            </span>
            {origen && (
              <Badge variant="outline" className={`${badgeCls} text-2xs px-1.5 py-0 h-4 w-fit font-normal`}>
                {origen}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      ...dateColumn<FacturaCxP>({
        id: "emision", header: "Emisión",
        accessor: (f) => f.fecha_emision,
      }),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...dateColumn<FacturaCxP>({
        id: "vencimiento", header: "Vencimiento",
        accessor: (f) => f.fecha_vencimiento,
      }),
      // En tableta damos algo menos de ancho para hacer espacio a Saldo/Estatus.
      meta: { width: "w-[95px] xl:w-[110px]", className: "text-xs whitespace-nowrap" },
    },
    {
      id: "dias", header: "Días",
      accessorFn: (f) => f.dias_vencido, enableSorting: true,
      sortingFn: sortByNumber<FacturaCxP>((f) => f.dias_vencido),
      // Título compactado a "Días" (antes "Días vencido"). Se oculta en <xl.
      meta: { width: "w-[70px]", align: "right", className: "tabular-nums text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const f = row.original;
        const saldada = f.estatus === "Pagada" || f.estatus === "Sin saldo";
        if (saldada || f.dias_vencido <= 0) return <span className="text-muted-foreground">—</span>;
        return <span className="text-destructive font-medium">{f.dias_vencido}</span>;
      },
    },
    {
      id: "moneda", header: "Mon.",
      meta: { width: "w-[60px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.moneda,
    },
    {
      ...moneyColumn<FacturaCxP>({
        id: "total", header: "Total",
        accessor: (f) => f.total,
        currencyAccessor: (f) => f.moneda,
      }),
      // Total oculto en tableta (<xl): mostramos Saldo como monto operativo principal.
      meta: { width: "w-[120px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<FacturaCxP>({
        id: "pagado", header: "Pagado",
        accessor: (f) => f.pagado,
        currencyAccessor: (f) => f.moneda,
      }),
      meta: { width: "w-[120px]", align: "right", className: "tabular-nums whitespace-nowrap text-success hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<FacturaCxP>({
        id: "saldo", header: "Saldo",
        accessor: (f) => f.saldo,
        currencyAccessor: (f) => f.moneda,
      }),
      meta: { width: "w-[115px] xl:w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      ...statusColumn<FacturaCxP>({
        id: "estatus", header: "Estatus",
        domain: "factura_cxp",
        accessor: (f) => f.estatus,
      }),
      meta: { width: "w-[110px]" },
    },
    {
      id: "aprobacion", header: "Aprobación",
      accessorFn: (f) => APROB_STATUS[f.estado_aprobacion as EstadoAprob],
      enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.estado_aprobacion),
      meta: { width: "w-[110px]", className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => {
        const ap = row.original.estado_aprobacion as EstadoAprob;
        return (
          <StatusBadge
            domain="aprobacion_cxp"
            status={APROB_STATUS[ap]}
            className={ap === "rechazada" && row.original.motivo_rechazo ? "cursor-help" : undefined}
          />
        );
      },
    },
  ]);
}
