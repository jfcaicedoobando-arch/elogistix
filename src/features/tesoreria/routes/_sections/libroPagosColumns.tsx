/**
 * Columnas del libro maestro de pagos.
 * Muestra tipo, contraparte, documento, método, monto original y su
 * equivalente en pesos, más el estado de conciliación y del complemento.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  TIPO_PAGO_LABELS, esEntrada, rutaDocumento, rutaMovimiento,
  type PagoLibro,
} from "@/features/tesoreria/domain/libroPagos";

const TIPO_CLASE: Record<PagoLibro["tipo"], string> = {
  cobro: "bg-success/10 text-success border-success/20",
  pago: "bg-primary/10 text-primary border-primary/20",
  anticipo: "bg-warning/10 text-warning border-warning/20",
};

const TIPO_CORTO: Record<PagoLibro["tipo"], string> = {
  cobro: "Cobro",
  pago: "Pago",
  anticipo: "Anticipo",
};

function EstadoRep({ pago }: { pago: PagoLibro }) {
  if (pago.tipo !== "cobro") return <span className="text-2xs text-muted-foreground">N/A</span>;
  const estado = (pago.estado_rep ?? "").toLowerCase();
  if (estado === "timbrado") {
    return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Timbrado</Badge>;
  }
  if (estado === "cancelado") {
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Cancelado</Badge>;
  }
  return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pendiente</Badge>;
}

export function libroPagosColumns(): ColumnDef<PagoLibro, unknown>[] {
  return defineColumns<PagoLibro>([
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (p) => p.fecha,
      meta: { width: "w-28" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">{formatDate(row.original.fecha)}</span>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (p) => TIPO_PAGO_LABELS[p.tipo],
      meta: { width: "w-28" },
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={TIPO_CLASE[row.original.tipo]}
          title={TIPO_PAGO_LABELS[row.original.tipo]}
        >
          {TIPO_CORTO[row.original.tipo]}
        </Badge>
      ),
    },
    {
      id: "contraparte",
      header: "Cliente / Proveedor",
      accessorFn: (p) => p.contraparte ?? "",
      cell: ({ row }) => (
        <div className="max-w-[240px]">
          <span className="block truncate" title={row.original.contraparte ?? ""}>
            {row.original.contraparte ?? "—"}
          </span>
          {row.original.notas ? (
            <span className="block truncate text-2xs text-muted-foreground" title={row.original.notas}>
              {row.original.notas}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "documento",
      header: "Documento",
      accessorFn: (p) => p.documento_folio ?? "",
      cell: ({ row }) => {
        const ruta = rutaDocumento(row.original);
        const folio = row.original.documento_folio ?? (row.original.tipo === "anticipo" ? "Sin factura" : "—");
        if (!ruta) return <span className="text-xs text-muted-foreground">{folio}</span>;
        return (
          <Link
            to={ruta}
            className="text-xs font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {folio}
          </Link>
        );
      },
    },
    {
      id: "metodo",
      header: "Método / Ref.",
      accessorFn: (p) => p.metodo_pago ?? "",
      cell: ({ row }) => (
        <div className="max-w-[160px]">
          <span className="block truncate text-xs">{row.original.metodo_pago ?? "—"}</span>
          {row.original.referencia ? (
            <span className="block truncate text-2xs text-muted-foreground">
              Ref. {row.original.referencia}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "cuenta",
      header: "Cuenta",
      accessorFn: (p) => p.cuenta_alias ?? "",
      cell: ({ row }) => (
        <span className="block max-w-[140px] truncate text-xs" title={row.original.cuenta_alias ?? ""}>
          {row.original.cuenta_alias ?? "—"}
        </span>
      ),
    },
    {
      id: "monto",
      header: "Monto",
      accessorFn: (p) => p.monto,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className={`tabular-nums ${esEntrada(row.original) ? "text-success" : "text-destructive"}`}
        >
          {formatCurrency(row.original.monto, row.original.moneda)}
        </span>
      ),
    },
    {
      id: "monto_mxn",
      header: "Equiv. MXN",
      accessorFn: (p) => p.monto_mxn,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {formatCurrency(row.original.monto_mxn, "MXN")}
        </span>
      ),
    },
    {
      id: "conciliado",
      header: "Conciliación",
      accessorFn: (p) => (p.conciliado ? "Conciliado" : "Pendiente"),
      meta: { width: "w-32" },
      cell: ({ row }) => {
        const ruta = rutaMovimiento(row.original);
        const badge = row.original.conciliado ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">Conciliado</Badge>
        ) : (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pendiente</Badge>
        );
        if (!ruta) return badge;
        return (
          <Link to={ruta} onClick={(e) => e.stopPropagation()} title="Ver en el estado de cuenta">
            {badge}
          </Link>
        );
      },
    },
    {
      id: "rep",
      header: "Complemento",
      accessorFn: (p) => p.estado_rep ?? "",
      meta: { width: "w-28" },
      cell: ({ row }) => <EstadoRep pago={row.original} />,
    },
  ]);
}
