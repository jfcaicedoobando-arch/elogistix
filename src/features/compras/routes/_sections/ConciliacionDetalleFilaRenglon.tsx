/**
 * Fila de renglón + sub-tabla de partidas para el desglose de conciliación
 * por embarque. Separado del componente principal para respetar los límites
 * de tamaño/complejidad.
 */
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import { ESTATUS_META, classFromNumber } from "./ConciliacionDetalleHelpers";

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
      <tr className="border-t hover:bg-muted/30">
        <td className="p-2 align-top">
          {tienePartidas ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expandido ? "Ocultar partidas" : "Ver partidas"}
              className="text-muted-foreground hover:text-foreground"
            >
              {expandido
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </td>
        <td className="p-2 align-top">
          <div className="font-medium">{fila.concepto}</div>
          <div className="text-[10px] text-muted-foreground">{fila.proveedor_nombre || "—"}</div>
        </td>
        <td className="p-2 text-right tabular-nums align-top">
          {formatCurrency(fila.cotizado, fila.moneda)}
        </td>
        <td className="p-2 text-right tabular-nums align-top">
          {formatCurrency(fila.real_facturado, fila.moneda)}
        </td>
        <td className={`p-2 text-right tabular-nums align-top ${dCls}`}>
          {formatCurrency(fila.diferencia, fila.moneda)}
        </td>
        <td className={`p-2 text-right tabular-nums align-top ${pCls}`}>
          {fila.desviacion_pct.toFixed(1)}%
        </td>
        <td className="p-2 align-top">
          <Badge variant={meta.variant} className="gap-1 text-[10px]">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </Badge>
        </td>
        <td className="p-2 align-top text-right">
          {!tienePartidas && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={onVincular}
            >
              <Link2 className="mr-1 h-3 w-3" /> Vincular
            </Button>
          )}
        </td>
      </tr>
      {expandido && tienePartidas && (
        <SubTablaPartidas fila={fila} />
      )}
    </>
  );
}

function SubTablaPartidas({ fila }: { fila: FilaReconciliacion }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={8} className="px-3 py-2">
        <table className="w-full text-[11px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left py-1 font-normal">Folio</th>
              <th className="text-left py-1 font-normal">Fecha</th>
              <th className="text-left py-1 font-normal">Descripción</th>
              <th className="text-right py-1 font-normal">Monto</th>
              <th className="text-right py-1 font-normal">% cot.</th>
            </tr>
          </thead>
          <tbody>
            {fila.facturas.map((p) => {
              const pct = fila.cotizado > 0 ? (p.monto / fila.cotizado) * 100 : 0;
              return (
                <tr
                  key={p.proveedor_factura_id + p.folio_proveedor}
                  className="border-t border-border/50"
                >
                  <td className="py-1 font-mono">{p.folio_proveedor}</td>
                  <td className="py-1">{p.fecha_emision ?? "—"}</td>
                  <td className="py-1">{p.descripcion ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatCurrency(p.monto, fila.moneda)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </td>
    </tr>
  );
}
