import { ChevronDown, ChevronRight, Layers, CheckCircle2, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/selects/SearchInput";
import { EmptyState } from "@/components/empty/EmptyState";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { montoPrincipalProforma } from "@/lib/domain/proforma";
import { useTabProformasPendientesController } from "@/hooks/facturacion/useTabProformasPendientesController";

export function TabProformasPendientes() {
  const c = useTabProformasPendientesController();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={c.search}
            onChange={c.setSearch}
            placeholder="Buscar por expediente, BL, cliente o número..."
            className="flex-1 min-w-[260px]"
          />
          <div className="flex flex-col items-end text-right text-xs leading-tight min-w-[160px]">
            <span className="text-muted-foreground">
              {c.totalSeleccionadas} seleccionada{c.totalSeleccionadas === 1 ? '' : 's'}
            </span>
            {c.totalesSeleccion.usd > 0 && (
              <span className="font-medium">{formatCurrency(c.totalesSeleccion.usd, 'USD')}</span>
            )}
            {c.totalesSeleccion.mxn > 0 && (
              <span className="font-medium">{formatCurrency(c.totalesSeleccion.mxn, 'MXN')}</span>
            )}
          </div>
          <Button
            variant="default"
            disabled={!c.puedeConsolidar || c.isConsolidarPending}
            onClick={c.handleConsolidar}
            title={
              c.expedientesEnSeleccion > 1
                ? 'Solo puedes consolidar proformas del mismo expediente'
                : 'Consolidar las proformas seleccionadas en una sola y aprobar'
            }
          >
            <Layers className="h-4 w-4 mr-2" /> Consolidar y aprobar
          </Button>
          <Button
            variant="outline"
            disabled={!c.puedeAprobar || c.isAprobarPending}
            onClick={c.handleAprobar}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar individual
          </Button>
        </CardContent>
      </Card>

      {c.isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Cargando proformas pendientes...</CardContent></Card>
      ) : c.grupos.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          No hay proformas pendientes de revisión
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {c.grupos.map(grupo => {
            const isCollapsed = c.collapsed.has(grupo.expediente);
            const seleccionadasGrupo = grupo.proformas.filter(p => c.selectedIds.has(p.id)).length;
            return (
              <Card key={grupo.expediente}>
                <button
                  type="button"
                  onClick={() => c.toggleCollapse(grupo.expediente)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left border-b"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    <div className="font-semibold truncate">EXPEDIENTE {grupo.expediente}</div>
                    {grupo.blMaster && (
                      <span className="text-xs text-muted-foreground">BL: <span className="font-mono">{grupo.blMaster}</span></span>
                    )}
                    <span className="text-xs text-muted-foreground truncate">Cliente: {grupo.clienteNombre}</span>
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
                          {cont.proformas.map(p => {
                            const monto = montoPrincipalProforma(p);
                            const checked = c.selectedIds.has(p.id);
                            return (
                              <label
                                key={p.id}
                                className="flex items-center gap-3 p-2.5 hover:bg-muted/40 cursor-pointer"
                              >
                                <Checkbox checked={checked} onCheckedChange={() => c.toggleSelect(p.id)} />
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
      )}
    </div>
  );
}
