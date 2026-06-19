import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSugerirCandidatos, useConciliarPago, useIgnorarMovimiento, useDesconciliar } from "@/features/tesoreria/hooks";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { MovimientoBBVA } from "@/features/tesoreria/services";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";

import { notifyError } from "@/components/shared/utils/appFeedback";
interface Props {
  movimiento: MovimientoBBVA | null;
  onClose: () => void;
}

export function PanelConciliacionMovimiento({ movimiento, onClose }: Props) {
  const { data: candidatos = [], isLoading } = useSugerirCandidatos(movimiento);
  const conciliar = useConciliarPago();
  const ignorar = useIgnorarMovimiento();
  const desconciliar = useDesconciliar();
  const [openIgnorar, setOpenIgnorar] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!movimiento) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
        Selecciona un movimiento de la izquierda para ver candidatos a conciliar.
      </CardContent></Card>
    );
  }

  const esCargo = Number(movimiento.cargo) > 0;
  const monto = esCargo ? Number(movimiento.cargo) : Number(movimiento.abono);

  const onConciliar = (tipo: "cxc" | "cxp", pagoId: string) => {
    conciliar.mutate(
      { movId: movimiento.id, tipo, pagoId },
      {
        onSuccess: () => { toast.success("Movimiento conciliado"); onClose(); },
        onError: (e) => notifyError(toast, { title: (e as Error).message, error: e, method: "FEATURES_TESORERIA_COMPONENTS_PANELCONCILIACIONMOVIMIENTO_1" }),
      },
    );
  };

  const onIgnorar = () => {
    if (!motivo.trim()) return notifyError(toast, { title: "Captura un motivo", method: "FEATURES_TESORERIA_COMPONENTS_PANELCONCILIACIONMOVIMIENTO_2" });
    ignorar.mutate(
      { movId: movimiento.id, motivo: motivo.trim() },
      {
        onSuccess: () => { toast.success("Movimiento ignorado"); setOpenIgnorar(false); setMotivo(""); onClose(); },
        onError: (e) => notifyError(toast, { title: (e as Error).message, error: e, method: "FEATURES_TESORERIA_COMPONENTS_PANELCONCILIACIONMOVIMIENTO_3" }),
      },
    );
  };

  const onDesconciliar = () => {
    desconciliar.mutate(movimiento.id, {
      onSuccess: () => { toast.success("Movimiento desconciliado"); onClose(); },
      onError: (e) => notifyError(toast, { title: (e as Error).message, error: e, method: "FEATURES_TESORERIA_COMPONENTS_PANELCONCILIACIONMOVIMIENTO_4" }),
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{formatDate(movimiento.fecha)} · {esCargo ? "Cargo" : "Abono"}</p>
          <p className="font-medium text-sm">{movimiento.concepto}</p>
          {movimiento.referencia && <p className="text-xs text-muted-foreground">Ref: {movimiento.referencia}</p>}
          <p className={`text-2xl font-bold tabular-nums mt-1 ${esCargo ? "text-destructive" : "text-success"}`}>
            {esCargo ? "−" : "+"} {formatCurrency(monto, "MXN")}
          </p>
        </div>

        {movimiento.estado_conciliacion === "Conciliado" ? (
          <>
            <Badge className="bg-success/10 text-success border-success/20">Conciliado</Badge>
            <Button variant="outline" size="sm" onClick={onDesconciliar} className="w-full">
              Desconciliar
            </Button>
          </>
        ) : movimiento.estado_conciliacion === "Ignorado" ? (
          <>
            <Badge variant="outline">Ignorado</Badge>
            {movimiento.motivo_ignorar && <p className="text-xs text-muted-foreground">Motivo: {movimiento.motivo_ignorar}</p>}
            <Button variant="outline" size="sm" onClick={onDesconciliar} className="w-full">
              Reactivar (volver a Pendiente)
            </Button>
          </>
        ) : (
          <>
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Candidatos (±$1, ±5 días)</h4>
              {isLoading ? <Skeleton className="h-20" /> : candidatos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin candidatos. Crea el pago manualmente desde CxC/CxP o ignora este movimiento.</p>
              ) : (
                <ul className="space-y-2">
                  {candidatos.map((c) => (
                    <li key={`${c.tipo}-${c.pago_id}`} className="border rounded p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.contraparte}</span>
                        <Badge variant="outline" className="text-[10px]">{c.tipo.toUpperCase()}</Badge>
                      </div>
                      <div className="text-muted-foreground">{formatDate(c.fecha)} · Ref {c.referencia || "—"}</div>
                      <div className="flex justify-between items-center">
                        <span className="tabular-nums font-medium">{formatCurrency(c.monto, c.moneda)}</span>
                        <Button size="sm" onClick={() => onConciliar(c.tipo, c.pago_id)} disabled={conciliar.isPending}>
                          Conciliar
                        </Button>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Δ monto {c.delta_monto.toFixed(2)} · Δ días {c.delta_dias}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => setOpenIgnorar(true)} className="w-full">
              Ignorar (comisión, traspaso, etc.)
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={openIgnorar} onOpenChange={setOpenIgnorar}>
        <DialogContent className={cn(dialogSize.md, scrollableDialog)}>
          <DialogHeader><DialogTitle>Ignorar movimiento</DialogTitle><DialogDescription>Confirma que el movimiento será ignorado en la conciliación.</DialogDescription></DialogHeader>
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Comisión bancaria, traspaso interno..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenIgnorar(false)}>Cancelar</Button>
            <Button onClick={onIgnorar}>Ignorar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
