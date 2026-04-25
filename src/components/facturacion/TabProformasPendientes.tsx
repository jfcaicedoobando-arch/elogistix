import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers, CheckCircle2, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/SearchInput";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  useProformasPendientes,
  useAprobarProformas,
  useConsolidarProformas,
  type ProformaPendienteConEmbarque,
} from "@/hooks/embarque/useProformas";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import {
  agruparProformasPendientes,
  montoPrincipalProforma,
  totalesProformasSeleccionadas,
} from "@/lib/domain/proforma";

export function TabProformasPendientes() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: proformas = [], isLoading } = useProformasPendientes();
  const aprobar = useAprobarProformas();
  const consolidar = useConsolidarProformas();
  const tasaIva = useTasaIVA();

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter(p =>
      p.expediente.toLowerCase().includes(q) ||
      p.cliente_nombre.toLowerCase().includes(q) ||
      (p.bl_master ?? '').toLowerCase().includes(q) ||
      (p.embarques?.bl_master ?? '').toLowerCase().includes(q) ||
      p.numero.toLowerCase().includes(q)
    );
  }, [proformas, search]);

  const grupos = useMemo(
    () => agruparProformasPendientes<ProformaPendienteConEmbarque>(filtradas),
    [filtradas],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCollapse = (expediente: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(expediente)) next.delete(expediente); else next.add(expediente);
      return next;
    });
  };

  const seleccionPorExpediente = useMemo(() => {
    const map = new Map<string, ProformaPendienteConEmbarque[]>();
    for (const g of grupos) {
      const sel = g.proformas.filter(p => selectedIds.has(p.id));
      if (sel.length > 0) map.set(g.expediente, sel);
    }
    return map;
  }, [grupos, selectedIds]);

  // Totales de la selección global (sumados por moneda)
  const totalesSeleccion = useMemo(
    () => totalesProformasSeleccionadas(proformas, selectedIds),
    [proformas, selectedIds],
  );

  const totalSeleccionadas = selectedIds.size;

  // Validar que la consolidación sea de un solo expediente
  const expedientesEnSeleccion = seleccionPorExpediente.size;
  const puedeConsolidar = totalSeleccionadas >= 2 && expedientesEnSeleccion === 1;
  const puedeAprobar = totalSeleccionadas >= 1;

  const handleConsolidar = () => {
    if (!puedeConsolidar) return;
    const [expediente, sel] = Array.from(seleccionPorExpediente.entries())[0];
    const grupo = grupos.find(g => g.expediente === expediente);
    if (!grupo) return;
    consolidar.mutate(
      {
        proformaIds: sel.map(p => p.id),
        embarqueId: grupo.embarqueId,
        clienteId: grupo.clienteId,
        clienteNombre: grupo.clienteNombre,
        expediente: grupo.expediente,
        blMaster: grupo.blMaster,
        operador: grupo.operador,
        diasCredito: grupo.diasCredito,
        tasaIva,
      },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  const handleAprobar = () => {
    if (!puedeAprobar) return;
    aprobar.mutate(
      { proformaIds: Array.from(selectedIds) },
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtros y acciones */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por expediente, BL, cliente o número..."
            className="flex-1 min-w-[260px]"
          />
          <div className="flex flex-col items-end text-right text-xs leading-tight min-w-[160px]">
            <span className="text-muted-foreground">
              {totalSeleccionadas} seleccionada{totalSeleccionadas === 1 ? '' : 's'}
            </span>
            {totalesSeleccion.usd > 0 && (
              <span className="font-medium">{formatCurrency(totalesSeleccion.usd, 'USD')}</span>
            )}
            {totalesSeleccion.mxn > 0 && (
              <span className="font-medium">{formatCurrency(totalesSeleccion.mxn, 'MXN')}</span>
            )}
          </div>
          <Button
            variant="default"
            disabled={!puedeConsolidar || consolidar.isPending}
            onClick={handleConsolidar}
            title={
              expedientesEnSeleccion > 1
                ? 'Solo puedes consolidar proformas del mismo expediente'
                : 'Consolidar las proformas seleccionadas en una sola y aprobar'
            }
          >
            <Layers className="h-4 w-4 mr-2" /> Consolidar y aprobar
          </Button>
          <Button
            variant="outline"
            disabled={!puedeAprobar || aprobar.isPending}
            onClick={handleAprobar}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar individual
          </Button>
        </CardContent>
      </Card>

      {/* Listado agrupado */}
      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Cargando proformas pendientes...</CardContent></Card>
      ) : grupos.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          No hay proformas pendientes de revisión
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {grupos.map(grupo => {
            const isCollapsed = collapsed.has(grupo.expediente);
            const seleccionadasGrupo = grupo.proformas.filter(p => selectedIds.has(p.id)).length;
            return (
              <Card key={grupo.expediente}>
                {/* Encabezado del expediente */}
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
      )}
    </div>
  );
}
