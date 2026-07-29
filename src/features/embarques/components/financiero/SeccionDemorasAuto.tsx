/**
 * Sección de demoras automáticas dentro del Tab Costos del embarque.
 * Permite calcular y recalcular las demoras tomando los días del timeline.
 * v13.232.0 · Confirmación migrada a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useRecalcularDemoras, useEliminarDemorasAuto } from "@/features/embarques/hooks/useDemorasEmbarque";
import type { DemoraDesglose } from "@/features/embarques/types/demoraDesglose";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

export function SeccionDemorasAuto({ embarqueId, canEdit }: Props) {
  const recalc = useRecalcularDemoras(embarqueId);
  const elim = useEliminarDemorasAuto(embarqueId);
  const [last, setLast] = useState<DemoraDesglose | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRecalcular = async () => {
    const res = await recalc.mutateAsync();
    setLast(res);
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="size-4" /> Demoras automáticas
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Calcula días excedidos = días en puerto (timeline) − días libres de la naviera, y aplica los tabuladores de costo y venta.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleRecalcular} disabled={recalc.isPending}>
              <RefreshCw className={`size-4 mr-2 ${recalc.isPending ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="size-4 mr-2" /> Eliminar auto
            </Button>
            <ConfirmActionDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Eliminar demoras automáticas"
              variant="destructive"
              confirmLabel="Eliminar"
              onConfirm={() => {
                elim.mutate();
                setConfirmOpen(false);
              }}
              description={'Se eliminarán los conceptos de costo y venta marcados como "demoras_auto". Los conceptos manuales no se tocarán.'}
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!last && (
          <p className="text-sm text-muted-foreground">Pulsa <strong>Recalcular</strong> para obtener el desglose actual.</p>
        )}
        {last?.sin_eventos && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="size-4 mt-0.5 text-warning" />
            <div>
              <p className="font-medium text-warning">Faltan eventos en el timeline</p>
              <p className="text-xs text-muted-foreground">Captura los eventos de <strong>Descarga</strong> y <strong>Entrega</strong> para poder calcular demoras.</p>
            </div>
          </div>
        )}
        {last && !last.sin_eventos && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <Stat label="Descarga" value={last.fecha_descarga ? formatDate(last.fecha_descarga) : '—'} />
              <Stat label="Devolución" value={last.fecha_devolucion ? formatDate(last.fecha_devolucion) : '—'} />
              <Stat label="Días puerto" value={(last.dias_en_puerto ?? 0).toString()} />
              <Stat label="Días libres" value={(last.dias_libres ?? 0).toString()} />
              <Stat label="Excedidos" value={(last.dias_excedidos ?? 0).toString()}
                className={(last.dias_excedidos ?? 0) > 0 ? 'text-destructive font-bold' : ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground uppercase">Costo total (naviera, {last.moneda_costo ?? 'USD'})</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(last.total_costo_usd, (last.moneda_costo ?? 'USD') as 'USD')}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground uppercase">Venta total (cliente)</p>
                <p className="text-lg font-bold tabular-nums text-success">{formatCurrency(last.total_venta_usd, 'USD')}</p>
              </div>
            </div>
            {last.contenedores.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <Badge variant="outline" className="mr-2">{last.contenedores.length} contenedor(es)</Badge>
                Generados con origen <code className="text-xs">demoras_auto</code>; aparecen en las tablas de Venta y Costo de abajo.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className={`tabular-nums ${className}`}>{value}</p>
    </div>
  );
}
