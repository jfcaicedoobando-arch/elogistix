import { ChevronRight, MoreHorizontal, Receipt, Trash2 } from "lucide-react";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate, formatDiasCredito } from "@/lib/formatters";
import { nombreDesdeEmail } from "@/lib/formatters/text";
import type { ProformaConFactura } from "@/features/proformas/services";
import { esBorradorVacio } from "./esBorradorVacio";
import { facturaEmitida } from "@/lib/domain/etiquetaCicloProforma";
import { getEstadoUnificado } from "@/lib/domain/estadoUnificado";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { Hint } from "@/components/shared/Hint";

interface Props {
  proformas: ProformaConFactura[];
  canEdit: boolean;
  isDeleting: boolean;
  /** Mantengo la firma para no romper TabFacturacion; ya no se usa inline. */
  onDescargar: (proformaId: string) => void;
  onEliminar: (id: string, numero: string) => void;
  /**
   * B9: facturas del embarque. Sirve para distinguir una proforma convertida a
   * factura BORRADOR de una realmente emitida (el estado de la proforma pasa a
   * `facturada` en cuanto se convierte).
   */
  facturas?: { estado: string; proforma_id?: string | null }[];
}

function renderEstado(
  p: ProformaConFactura,
  proformas: ProformaConFactura[],
  emitidas: Set<string>,
) {
  const rev = p.estado_revision ?? "aprobada";
  const vacio = esBorradorVacio(p);
  const unificado = getEstadoUnificado(p);

  // 1. Cerrados / especiales — mantienen su badge propio.
  if (unificado === "facturada") {
    return emitidas.has(p.id)
      ? <Badge variant="success" className="w-fit">Facturada</Badge>
      : <Badge variant="info" className="w-fit">Convertida a borrador</Badge>;
  }
  if (vacio) return (
    <Badge variant="outline" className="w-fit bg-warning/10 text-warning border-warning/30">
      Borrador vacío
    </Badge>
  );
  if (rev === "consolidada") {
    const num = proformas.find(x => x.id === p.consolidada_en)?.numero;
    return <Badge variant="info" className="w-fit">Consolidada{num ? ` en ${num}` : ""}</Badge>;
  }

  // 2. Respuesta del cliente tiene prioridad sobre revisión interna.
  if (unificado === "rechazada") return <Badge variant="destructive" className="w-fit">Rechazada</Badge>;
  if (unificado === "aceptada") return <Badge variant="success" className="w-fit">Aceptada</Badge>;

  // 3. Sin respuesta del cliente: reflejar el estado de revisión interna.
  if (rev === "pendiente") return <Badge variant="warning" className="w-fit">Pendiente cliente</Badge>;
  return <Badge variant="outline" className="w-fit">Enviada al cliente</Badge>;
}


function totalUnico(p: ProformaConFactura) {
  const usd = Number(p.total_usd);
  const mxn = Number(p.total_mxn);
  if (usd > 0 && mxn === 0) return formatCurrency(usd, "USD");
  if (mxn > 0 && usd === 0) return formatCurrency(mxn, "MXN");
  if (usd > 0 && mxn > 0) {
    return (
      <div className="flex flex-col items-end leading-tight">
        <span>{formatCurrency(usd, "USD")}</span>
        <span className="text-body-sm text-muted-foreground">{formatCurrency(mxn, "MXN")}</span>
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export function HistorialProformas({
  proformas, canEdit, isDeleting, onEliminar, facturas = [],
}: Props) {
  const emitidas = new Set(
    facturas
      .filter(f => facturaEmitida({ estado: f.estado }) && f.proforma_id)
      .map(f => f.proforma_id as string),
  );
  const convertidasCount = proformas.filter(p => p.estado_proforma === "facturada").length;
  const facturadasCount = proformas.filter(p => emitidas.has(p.id)).length;

  const columns: ColumnDef<ProformaConFactura, unknown>[] = defineColumns<ProformaConFactura>([
    { id: "numero", header: "Número", meta: { className: "font-medium" }, cell: ({ row }) => row.original.numero },
    { id: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha_emision) },
    {
      id: "operador",
      header: "Operador",
      meta: { className: "text-body max-w-[180px]" },
      cell: ({ row }) => {
        const email = row.original.operador;
        if (!email) return <span className="text-muted-foreground">—</span>;
        return (
          <Hint label={email}>
            <span className="truncate block">
              {nombreDesdeEmail(email)}
            </span>
          </Hint>
        );
      },
    },
    {
      id: "credito",
      header: "Días Crédito",
      meta: { align: "right", className: "text-body" },
      cell: ({ row }) => formatDiasCredito(row.original.dias_credito),
    },
    {
      id: "total",
      header: "Total",
      meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => totalUnico(row.original),
    },
    { id: "estado", header: "Estado", cell: ({ row }) => renderEstado(row.original, proformas, emitidas) },
    {
      id: "acciones",
      header: "",
      meta: { align: "right", className: "w-10" },
      cell: ({ row }) => {
        const p = row.original;
        const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
        const consolidada = (p.estado_revision ?? "aprobada") === "consolidada";
        const puedeEliminar = canEdit && !facturada && !consolidada;
        if (!puedeEliminar) {
          return <ChevronRight className="size-4 ml-auto text-muted-foreground transition-colors group-hover:text-foreground" />;
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Acciones de la proforma ${p.numero}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={isDeleting}
                onClick={(e) => { e.stopPropagation(); onEliminar(p.id, p.numero); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar proforma
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ]);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle>Proformas Generadas</CardTitle>
        {proformas.length > 0 && (
          <span className="text-body-sm text-muted-foreground">
            {proformas.length} proforma{proformas.length === 1 ? "" : "s"}
            {facturadasCount > 0 && <> · {facturadasCount} facturada{facturadasCount === 1 ? "" : "s"}</>}
            {convertidasCount - facturadasCount > 0 && (
              <> · {convertidasCount - facturadasCount} sin emitir</>
            )}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={proformas}
          rowKey={(p) => p.id}
          density={TABLE_DENSITY.embebida}
          getRowHref={(p) => `/proformas/${p.id}`}
          rowClassName={() => "cursor-pointer hover:bg-muted/40"}
          emptyIcon={Receipt}
          emptyMessage="No hay proformas generadas para este embarque."
        />
      </CardContent>
    </Card>
  );
}
