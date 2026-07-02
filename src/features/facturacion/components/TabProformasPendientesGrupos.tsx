import { ChevronDown, ChevronRight, CheckCircle2, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { montoPrincipalProforma } from "@/features/proformas/domain/proforma";
import type { useTabProformasPendientesController } from "@/features/facturacion/hooks";

type Controller = ReturnType<typeof useTabProformasPendientesController>;

interface Props {
  isLoading: Controller["isLoading"];
  grupos: Controller["grupos"];
  collapsed: Controller["collapsed"];
  selectedIds: Controller["selectedIds"];
  toggleCollapse: Controller["toggleCollapse"];
  toggleSelect: Controller["toggleSelect"];
}

export function TabProformasPendientesGrupos({
  isLoading, grupos, collapsed, selectedIds, toggleCollapse, toggleSelect,
}: Props) {
  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Cargando proformas pendientes...</CardContent></Card>;
  }
  if (grupos.length === 0) {
    return (
      <Card><CardContent className="p-0">
        <EmptyState
          icon={CheckCircle2}
          title="Todo al día"
          description="No hay proformas pendientes de revisión."
        />
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-3">
      {grupos.map((grupo) => {
        const isCollapsed = collapsed.has(grupo.expediente);
        const seleccionadasGrupo = grupo.proformas.filter((p) => selectedIds.has(p.id)).length;
        return (
          <Card key={grupo.expediente}>
            <button
              type="button"
              onClick={() => toggleCollapse(grupo.expediente)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left border-b"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                <div className="font-semibold truncate">EXPEDIENTE {grupo.expediente}</div>
                {grupo.blMaster && (
                  <span className="text-xs text-muted-foreground">BL: <span className="font-mono">{grupo.blMaster}</span></span>
                )}
                <span className="text-xs text-muted-foreground truncate">Cliente: {toTitleCase(grupo.clienteNombre)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {seleccionadasGrupo > 0 && (
                  <Badge variant="secondary">{seleccionadasGrupo} sel.</Badge>
                )}
                <Badge variant="outline">{grupo.proformas.length} proforma{grupo.proformas.length === 1 ? '' : 's'}</Badge>
              </div>
            </button>

            {!isCollapsed && (
              <CardContent className="p-4 space-y-4">
                {grupo.contenedores.map((cont, idx) => (
                  <div key={(cont.contenedor ?? 'sc') + idx} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Package className="h-4 w-4" />
                      {cont.contenedor ? (
                        <>
                          Contenedor <span className="font-mono text-foreground">{cont.contenedor}</span>
                          {cont.tipo_contenedor && <span className="text-xs">({cont.tipo_contenedor})</span>}
                        </>
                      ) : (
                        <span>Sin contenedor asignado</span>
                      )}
                    </div>
                    <div className="rounded-md border divide-y">
                      {cont.proformas.map((p) => {
                        const monto = montoPrincipalProforma(p);
                        const checked = selectedIds.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 p-2.5 hover:bg-muted/40 cursor-pointer"
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleSelect(p.id)} />
                            <span className="font-mono text-sm w-32 truncate">{p.numero}</span>
                            <span className="flex-1 text-sm truncate text-muted-foreground">
                              {p.notas?.trim() ? p.notas : '—'}
                            </span>
                            <span className="text-sm font-medium tabular-nums w-32 text-right">
                              {formatCurrency(monto.valor, monto.moneda)}
                            </span>
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              {formatDate(p.fecha_emision)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
