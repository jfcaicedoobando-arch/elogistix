/**
 * Fila de renglón + sub-tabla de partidas para el desglose de conciliación
 * por embarque. Separado del componente principal para respetar los límites
 * de tamaño/complejidad.
 */
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import { ESTATUS_META, classFromNumber } from "./ConciliacionDetalleHelpers";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  fila: FilaReconciliacion;
  expandido: boolean;
  onToggle: () => void;
  onVincular: () => void;
}

export function FilaRenglon({ fila, expandido, onToggle, onVincular }: Props) {
  const meta = ESTATUS_META[fila.estatus_renglon];
  const tienePartidas = fila.facturas.length > 0;
  const dCls = classFromNumber(fila.diferencia);
  const pCls = classFromNumber(fila.desviacion_pct);

  return (
    <>
      <TableRow className="border-t hover:bg-muted/30">
        <TableCell className="align-top">
          {tienePartidas ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label={expandido ? "Ocultar partidas" : "Ver partidas"}
              className="min-h-11 min-w-11 md:h-6 md:w-6 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-foreground"
            >
              {expandido
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          ) : null}
        </TableCell>
        <TableCell className="align-top">
          <div className="font-medium">{fila.concepto}</div>
          <div className="text-2xs text-muted-foreground">{fila.proveedor_nombre || "—"}</div>
        </TableCell>
        <TableCell className="text-right tabular-nums align-top">
          {formatCurrency(fila.cotizado, fila.moneda)}
        </TableCell>
        <TableCell className="text-right tabular-nums align-top">
          {formatCurrency(fila.real_facturado, fila.moneda)}
        </TableCell>
        <TableCell className={`p-2 text-right tabular-nums align-top ${dCls}`}>
          {formatCurrency(fila.diferencia, fila.moneda)}
        </TableCell>
        <TableCell className={`p-2 text-right tabular-nums align-top ${pCls}`}>
          {formatPercent(fila.desviacion_pct)}
        </TableCell>
        <TableCell className="align-top">
          <Badge variant={meta.variant} className="gap-1 text-2xs">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </Badge>
        </TableCell>
        <TableCell className="align-top text-right">
          {!tienePartidas && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-label"
              onClick={onVincular}
            >
              <Link2 className="mr-1 h-3 w-3" /> Vincular
            </Button>
          )}
        </TableCell>
      </TableRow>
      {expandido && tienePartidas && (
        <SubTablaPartidas fila={fila} />
      )}
    </>
  );
}

function SubTablaPartidas({ fila }: { fila: FilaReconciliacion }) {
  return (
    <TableRow className="bg-muted/20">
      <TableCell colSpan={8}>
        <div className="overflow-x-auto">
        <Table className="w-full text-label">
          <TableHeader className="text-muted-foreground">
            <TableRow>
              <DetailTableHead className="font-normal">Folio</DetailTableHead>
              <DetailTableHead className="font-normal">Fecha</DetailTableHead>
              <DetailTableHead className="font-normal">Descripción</DetailTableHead>
              <DetailTableHead className="text-right font-normal">Monto</DetailTableHead>
              <DetailTableHead className="text-right font-normal">% cot.</DetailTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fila.facturas.map((p) => {
              const pct = fila.cotizado > 0 ? (p.monto / fila.cotizado) * 100 : 0;
              return (
                <TableRow key={p.proveedor_factura_id + p.folio_proveedor} className="border-t border-border/50">
                  <TableCell className="font-mono">{p.folio_proveedor}</TableCell>
                  <TableCell>{p.fecha_emision ?? "—"}</TableCell>
                  <TableCell>{p.descripcion ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.monto, fila.moneda)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatPercent(pct)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </TableCell>
    </TableRow>
  );
}
