import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { useConsolidarYAprobar } from "@/hooks/embarque/useProformas";
import type { ExpedienteConsolidado } from "@/hooks/embarque/useExpedientesConsolidados";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expediente: ExpedienteConsolidado | null;
}

export function DialogConsolidarAprobar({ open, onOpenChange, expediente }: Props) {
  const consolidar = useConsolidarYAprobar();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [diasCredito, setDiasCredito] = useState<string>("");

  // Pre-seleccionar todas las borrador al abrir
  useEffect(() => {
    if (open && expediente) {
      setSeleccion(new Set(expediente.proformasBorrador.map(p => p.id)));
      setDiasCredito("");
    }
  }, [open, expediente]);

  const seleccionadas = useMemo(
    () => (expediente?.proformasBorrador || []).filter(p => seleccion.has(p.id)),
    [expediente, seleccion]
  );

  const totales = useMemo(() => {
    return seleccionadas.reduce(
      (acc, p) => ({
        subtotal_usd: acc.subtotal_usd + p.subtotal_usd,
        iva_usd: acc.iva_usd + p.iva_usd,
        total_usd: acc.total_usd + p.total_usd,
        subtotal_mxn: acc.subtotal_mxn + p.subtotal_mxn,
        iva_mxn: acc.iva_mxn + p.iva_mxn,
        total_mxn: acc.total_mxn + p.total_mxn,
      }),
      { subtotal_usd: 0, iva_usd: 0, total_usd: 0, subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0 }
    );
  }, [seleccionadas]);

  if (!expediente) return null;

  const togglePf = (id: string) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmar = () => {
    if (seleccionadas.length < 2) return;

    // Reunir embarques implicados
    const embarquesIds = new Set<string>();
    seleccionadas.forEach(p => {
      if (p.embarque_id) embarquesIds.add(p.embarque_id);
      (p.embarques_ids || []).forEach(id => embarquesIds.add(id));
    });
    const embarquesIdsArr = Array.from(embarquesIds);
    const principal = expediente.embarques.find(e => embarquesIdsArr.includes(e.id))?.id
      ?? embarquesIdsArr[0]
      ?? expediente.embarques[0].id;

    consolidar.mutate({
      proformaIds: seleccionadas.map(p => p.id),
      embarquesIds: embarquesIdsArr,
      embarquePrincipalId: principal,
      clienteId: expediente.cliente_id,
      clienteNombre: expediente.cliente_nombre,
      expediente: expediente.expediente,
      blMaster: expediente.bl_master,
      totales,
      diasCredito: diasCredito.trim() === "" ? null : Number(diasCredito),
      operador: expediente.operador,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Consolidar y aprobar proformas</DialogTitle>
          <DialogDescription>
            Expediente <span className="font-mono">{expediente.expediente}</span>
            {expediente.bl_master && <> · BL <span className="font-mono">{expediente.bl_master}</span></>}
            {" · "}{expediente.cliente_nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-md divide-y">
            <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2">
              <div className="col-span-1"></div>
              <div className="col-span-4">Proforma</div>
              <div className="col-span-3 text-right">Total USD</div>
              <div className="col-span-3 text-right">Total MXN</div>
              <div className="col-span-1 text-right">Tipo</div>
            </div>
            {expediente.proformasBorrador.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No hay proformas en borrador para este expediente.
              </div>
            ) : (
              expediente.proformasBorrador.map(p => (
                <label
                  key={p.id}
                  htmlFor={`pf-${p.id}`}
                  className="px-3 py-2 grid grid-cols-12 gap-2 items-center cursor-pointer hover:bg-muted/30"
                >
                  <div className="col-span-1">
                    <Checkbox
                      id={`pf-${p.id}`}
                      checked={seleccion.has(p.id)}
                      onCheckedChange={() => togglePf(p.id)}
                    />
                  </div>
                  <div className="col-span-4 font-mono text-sm">{p.numero}</div>
                  <div className="col-span-3 text-right text-sm">
                    {p.total_usd > 0 ? formatCurrency(p.total_usd, 'USD') : '—'}
                  </div>
                  <div className="col-span-3 text-right text-sm">
                    {p.total_mxn > 0 ? formatCurrency(p.total_mxn, 'MXN') : '—'}
                  </div>
                  <div className="col-span-1 text-right">
                    {p.es_consolidada
                      ? <Badge variant="outline" className="text-xs">Cons</Badge>
                      : <Badge variant="outline" className="text-xs">Ind</Badge>}
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-semibold mb-1">Total consolidado</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {totales.total_usd > 0 && (
                <>
                  <span className="text-muted-foreground">Subtotal USD:</span>
                  <span className="text-right">{formatCurrency(totales.subtotal_usd, 'USD')}</span>
                  <span className="text-muted-foreground">IVA USD:</span>
                  <span className="text-right">{formatCurrency(totales.iva_usd, 'USD')}</span>
                  <span className="font-semibold">Total USD:</span>
                  <span className="text-right font-semibold">{formatCurrency(totales.total_usd, 'USD')}</span>
                </>
              )}
              {totales.total_mxn > 0 && (
                <>
                  <span className="text-muted-foreground">Subtotal MXN:</span>
                  <span className="text-right">{formatCurrency(totales.subtotal_mxn, 'MXN')}</span>
                  <span className="text-muted-foreground">IVA MXN:</span>
                  <span className="text-right">{formatCurrency(totales.iva_mxn, 'MXN')}</span>
                  <span className="font-semibold">Total MXN:</span>
                  <span className="text-right font-semibold">{formatCurrency(totales.total_mxn, 'MXN')}</span>
                </>
              )}
              {totales.total_usd === 0 && totales.total_mxn === 0 && (
                <span className="col-span-2 text-muted-foreground text-xs">Selecciona al menos una proforma</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dias-credito">Días de crédito</Label>
            <Input
              id="dias-credito"
              type="number"
              min={0}
              value={diasCredito}
              onChange={(e) => setDiasCredito(e.target.value)}
              placeholder="0 = contado"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={consolidar.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={seleccionadas.length < 2 || consolidar.isPending}
          >
            {consolidar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Consolidar y aprobar ({seleccionadas.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
