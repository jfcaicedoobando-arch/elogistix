/**
 * v12.14.0 — Subcomponente del resumen de conceptos venta. Renderiza un
 * bloque por contenedor (o por "Cargos generales del BL") con su mini-tabla
 * y subtotales. Sólo se usa cuando el embarque tiene ≥2 contenedores reales.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { EstadoConceptoBadge, type EstadoConcepto } from "./estadoConceptoBadge";
import type { Tables } from "@/types/db";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

type ConceptoVenta = Tables<"conceptos_venta">;

interface Props {
  titulo: string;
  subtitulo?: string;
  conceptos: ConceptoVenta[];
  /** Si null, no se muestra el botón "Generar". */
  onGenerar?: (() => void) | null;
  canEdit: boolean;
  pendientesCount: number;
  estadosConceptos: Map<string, EstadoConcepto>;
}

export function GrupoConceptosContenedor({
  titulo, subtitulo, conceptos, onGenerar, canEdit, pendientesCount, estadosConceptos,
}: Props) {
  const estadoDe = (id: string): EstadoConcepto => estadosConceptos.get(id) ?? "pendiente";
  const totales = sumarPorMoneda(conceptos.filter((c) => estadoDe(c.id) !== "pendiente"));

  return (
    <div className="border-t">
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/40 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{titulo}</span>
          {subtitulo && (
            <span className="text-xs text-muted-foreground truncate">· {subtitulo}</span>
          )}
          <Badge variant="secondary" className="ml-1">{conceptos.length}</Badge>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {(totales.mxn > 0 || totales.usd > 0) && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {totales.mxn > 0 && <>{formatCurrency(totales.mxn, "MXN")}</>}
              {totales.mxn > 0 && totales.usd > 0 && <> · </>}
              {totales.usd > 0 && <>{formatCurrency(totales.usd, "USD")}</>}
            </span>
          )}
          {canEdit && onGenerar && pendientesCount > 0 && (
            <Button size="sm" variant="outline" onClick={onGenerar}>
              Generar proforma
              <Badge variant="secondary" className="ml-2">{pendientesCount}</Badge>
            </Button>
          )}
        </div>
      </div>
      <DataTable<ConceptoVenta>
        columns={defineColumns<ConceptoVenta>([
          {
            id: "descripcion", header: "Descripción", meta: { className: "font-medium" },
            cell: ({ row }) => {
              const c = row.original;
              return (
                <>
                  {c.descripcion}
                  {c.moneda === "USD" && c.aplica_iva && (
                    <Badge variant="warning" className="ml-2 text-xs">+IVA</Badge>
                  )}
                </>
              );
            },
          },
          { id: "cant", header: "Cant.", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => row.original.cantidad },
          { id: "pu", header: "P. Unit.", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda) },
          { id: "total", header: "Total", meta: { className: "text-right font-semibold tabular-nums", headerClassName: "text-right" },
            cell: ({ row }) => formatCurrency(Number(row.original.cantidad) * Number(row.original.precio_unitario), row.original.moneda) },
          { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
          {
            id: "estado", header: "Estado",
            cell: ({ row }) => <EstadoConceptoBadge estado={estadoDe(row.original.id)} />,
          },
        ]) as ColumnDef<ConceptoVenta, unknown>[]}
        data={conceptos}
        rowKey={(c) => c.id}
        density={TABLE_DENSITY.embebida}
      />
    </div>
  );
}

function sumarPorMoneda(items: ConceptoVenta[]) {
  let usd = 0, mxn = 0;
  for (const c of items) {
    const sub = Number(c.cantidad) * Number(c.precio_unitario);
    if (c.moneda === "USD") usd += sub; else mxn += sub;
  }
  return { usd, mxn };
}
