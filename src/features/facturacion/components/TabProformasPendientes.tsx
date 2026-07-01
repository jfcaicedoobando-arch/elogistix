import { ChevronDown, ChevronRight, Layers, CheckCircle2, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip";
import SearchInput from "@/components/shared/SearchInput";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { montoPrincipalProforma } from "@/features/proformas/domain/proforma";
import { useTabProformasPendientesController } from "@/features/facturacion/hooks";


export function TabProformasPendientes({ isInRange }: { isInRange?: (fecha: string | null | undefined) => boolean }) {
  const c = useTabProformasPendientesController({ isInRange });


  function renderGrupos() {
    if (c.isLoading) {
      return <Card><CardContent className="p-6 text-center text-muted-foreground">Cargando proformas pendientes...</CardContent></Card>;
    }
    if (c.grupos.length === 0) {
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
    );
  }

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
          <Select value={c.filtroCliente} onValueChange={c.setFiltroCliente}>
            <SelectTrigger className="w-[200px]" aria-label="Filtrar por cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {c.clientesDisponibles.map((cli) => (
                <SelectItem key={cli} value={cli}>{toTitleCase(cli)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={c.filtroAntiguedad}
            onValueChange={(v) => c.setFiltroAntiguedad(v as "todos" | "7" | "15" | "30")}
          >
            <SelectTrigger className="w-[160px]" aria-label="Filtrar por antigüedad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Cualquier antigüedad</SelectItem>
              <SelectItem value="7">Más de 7 días</SelectItem>
              <SelectItem value="15">Más de 15 días</SelectItem>
              <SelectItem value="30">Más de 30 días</SelectItem>
            </SelectContent>
          </Select>
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
              c.embarquesEnSeleccion > 1
                ? 'Solo puedes consolidar proformas del mismo embarque'
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


      {renderGrupos()}
    </div>
  );
}
