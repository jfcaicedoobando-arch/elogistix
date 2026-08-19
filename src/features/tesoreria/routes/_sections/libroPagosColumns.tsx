/**
 * Columnas del libro maestro de pagos.
 * Muestra tipo, contraparte, documento, método, monto original y su
 * equivalente en pesos, más el estado de conciliación y del complemento.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  TIPO_PAGO_LABELS, esEntrada,
  type PagoLibro,
} from "@/features/tesoreria/domain/libroPagos";

/**
 * VT-28: el libro de pagos mostraba la clave SAT cruda ("03") en la columna
 * Método. Mapeamos los códigos más comunes a etiquetas cortas y, para el
 * resto, reutilizamos el catálogo SAT quitando el prefijo "NN - ".
 * Valores ya textuales (p. ej. "Transferencia" de pagos programados) pasan tal cual.
 */
const METODO_PAGO_LABELS_CORTOS: Record<string, string> = {
  "01": "Efectivo",
  "02": "Cheque",
  "03": "Transferencia",
  "04": "Tarjeta de crédito",
  "28": "Tarjeta de débito",
  "30": "Aplicación de anticipos",
  "99": "Por definir",
};

function etiquetaMetodoPago(metodo: string | null): string {
  if (!metodo) return "—";
  const corto = METODO_PAGO_LABELS_CORTOS[metodo];
  if (corto) return corto;
  if (/^\d{2}$/.test(metodo)) {
    return labelDeCatalogo(FORMAS_PAGO_SAT, metodo, metodo).replace(/^\d{2} - /, "");
  }
  return metodo;
}

/** Normaliza el estado crudo del REP al vocabulario del dominio `rep`. */
function estadoRepCanonico(crudo: string | null | undefined): string {
  const estado = (crudo ?? "").toLowerCase();
  if (estado === "timbrado") return "Timbrado";
  if (estado === "cancelado") return "Cancelado";
  return "Pendiente";
}

function EstadoRep({ pago }: { pago: PagoLibro }) {
  if (pago.tipo !== "cobro") return <span className="text-2xs text-muted-foreground">N/A</span>;
  return <StatusBadge domain="rep" status={estadoRepCanonico(pago.estado_rep)} />;
}

export function libroPagosColumns(): ColumnDef<PagoLibro, unknown>[] {
  return defineColumns<PagoLibro>([
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (p) => p.fecha,
      meta: { width: "w-28" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-body-sm">{formatDate(row.original.fecha)}</span>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (p) => TIPO_PAGO_LABELS[p.tipo],
      meta: { width: "w-28" },
      cell: ({ row }) => (
        <StatusBadge domain="pago_tipo" status={row.original.tipo} />
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
        const folio = row.original.documento_folio ?? (row.original.tipo === "anticipo" ? "Sin factura" : "—");
        const enLote = row.original.tipo === "pago" && !!row.original.lote_id;
        return (
          <div className="space-y-0.5">
            <span className="block text-body-sm font-medium">{folio}</span>
            {enLote ? (
              <span className="block text-2xs text-muted-foreground">Parte de un pago en lote</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "metodo",
      header: "Método / Ref.",
      accessorFn: (p) => p.metodo_pago ?? "",
      cell: ({ row }) => (
        <div className="max-w-[160px]">
          <span
            className="block truncate text-body-sm"
            title={labelDeCatalogo(FORMAS_PAGO_SAT, row.original.metodo_pago, row.original.metodo_pago ?? undefined)}
          >
            {etiquetaMetodoPago(row.original.metodo_pago)}
          </span>
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
        <span className="block max-w-[140px] truncate text-body-sm" title={row.original.cuenta_alias ?? ""}>
          {row.original.cuenta_alias ?? "—"}
        </span>
      ),
    },
    {
      id: "monto",
      header: "Monto",
      accessorFn: (p) => p.monto,
      // VT-28: min-width + nowrap para que "MXN" y la cifra no envuelvan en 2 líneas.
      meta: { align: "right", width: "w-32 min-w-[8rem]" },
      cell: ({ row }) => (
        <span
          className={`whitespace-nowrap tabular-nums ${esEntrada(row.original) ? "text-success" : "text-destructive"}`}
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
        <span className="tabular-nums text-body-sm text-muted-foreground">
          {formatCurrency(row.original.monto_mxn, "MXN")}
        </span>
      ),
    },
    {
      id: "conciliado",
      header: "Conciliación",
      accessorFn: (p) => (p.conciliado ? "Conciliado" : "Pendiente"),
      meta: { width: "w-32" },
      cell: ({ row }) =>
        (
          <StatusBadge
            domain="conciliacion"
            status={row.original.conciliado ? "Conciliado" : "Pendiente"}
          />
        ),
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
