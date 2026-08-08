import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useSugerirCandidatos, useConciliarPago, useIgnorarMovimiento, useDesconciliar, useEliminarMovimientoManual } from "@/features/tesoreria/hooks";
import { esMovimientoManual } from "@/features/tesoreria/services";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { MovimientoBBVA } from "@/features/tesoreria/services";

import { notifyError } from "@/lib/ui/appFeedback";
import { DetallePagoSheet } from "@/features/tesoreria/components/DetallePagoSheet";
import { refPagoDeMovimiento } from "@/features/tesoreria/domain/pagoDetalle";
interface Props {
  movimiento: MovimientoBBVA | null;
  onClose: () => void;
}

export function PanelConciliacionMovimiento({ movimiento, onClose }: Props) {
  const { data: candidatos = [], isLoading } = useSugerirCandidatos(movimiento);
  const conciliar = useConciliarPago();
  const ignorar = useIgnorarMovimiento();
  const desconciliar = useDesconciliar();
  const eliminar = useEliminarMovimientoManual();
  const [openIgnorar, setOpenIgnorar] = useState(false);
  const [openEliminar, setOpenEliminar] = useState(false);
  const [verPago, setVerPago] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!movimiento) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
        Selecciona un movimiento de la izquierda para ver candidatos a conciliar.
      </CardContent></Card>
    );
  }

  const refPago = refPagoDeMovimiento(movimiento);
  const esCargo = Number(movimiento.cargo) > 0;
  const monto = esCargo ? Number(movimiento.cargo) : Number(movimiento.abono);

  // 13.85.10 — Toasts viven en los hooks (`useConciliarPago`, `useIgnorarMovimiento`, `useDesconciliar`).
  // Aquí sólo coordinamos cierre del panel y reset de inputs.
  const onConciliar = (tipo: "cxc" | "cxp", pagoId: string) => {
    conciliar.mutate(
      { movId: movimiento.id, tipo, pagoId },
      { onSuccess: () => onClose() },
    );
  };

  const onIgnorar = () => {
    if (!motivo.trim()) return notifyError(undefined, { title: "Captura un motivo", method: "FEATURES_TESORERIA_COMPONENTS_PANELCONCILIACIONMOVIMIENTO_2" });
    ignorar.mutate(
      { movId: movimiento.id, motivo: motivo.trim() },
      { onSuccess: () => { setOpenIgnorar(false); setMotivo(""); onClose(); } },
    );
  };

  const onEliminar = () => {
    if (!movimiento) return;
    eliminar.mutate(movimiento.id, {
      onSuccess: () => { setOpenEliminar(false); onClose(); },
    });
  };

  const onDesconciliar = () => {
    desconciliar.mutate(movimiento.id, {
      onSuccess: () => onClose(),
    });
  };


  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <KpiCard
          label={`${formatDate(movimiento.fecha)} · ${esCargo ? "Cargo" : "Abono"}`}
          value={`${esCargo ? "−" : "+"} ${formatCurrency(monto, "MXN")}`}
          variant={esCargo ? "destructive" : "success"}
          sublabel={movimiento.concepto}
          className="border-none shadow-none"
        >
          {movimiento.referencia && (
            <p className="text-xs text-muted-foreground">Ref: {movimiento.referencia}</p>
          )}
        </KpiCard>

        {movimiento.estado_conciliacion === "Conciliado" ? (
          <>
            <Badge className="bg-success/10 text-success border-success/20">Conciliado</Badge>
            {refPago ? (
              <Button variant="outline" size="sm" onClick={() => setVerPago(true)} className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                Ver detalle del pago
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Este movimiento está conciliado, pero no guarda el pago con el que se amarró.
              </p>
            )}
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
              {isLoading ? <CardSkeleton lines={2} showHeader={false} /> : candidatos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin candidatos. Crea el pago manualmente desde CxC/CxP o ignora este movimiento.</p>
              ) : (
                <ul className="space-y-2">
                  {candidatos.map((c) => (
                    <li key={`${c.tipo}-${c.pago_id}`} className="border rounded p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.contraparte}</span>
                        <Badge variant="outline" className="text-2xs">{c.tipo.toUpperCase()}</Badge>
                      </div>
                      <div className="text-muted-foreground">{formatDate(c.fecha)} · Ref {c.referencia || "—"}</div>
                      <div className="flex justify-between items-center">
                        <span className="tabular-nums font-medium">{formatCurrency(c.monto, c.moneda)}</span>
                        <Button size="sm" onClick={() => onConciliar(c.tipo, c.pago_id)} disabled={conciliar.isPending}>
                          Conciliar
                        </Button>
                      </div>
                      <div className="text-2xs text-muted-foreground">
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

        {esMovimientoManual(movimiento) && movimiento.estado_conciliacion !== "Conciliado" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenEliminar(true)}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar movimiento manual
          </Button>
        )}
      </CardContent>

      <DetallePagoSheet
        ref_pago={verPago ? refPago : null}
        onOpenChange={(open) => { if (!open) setVerPago(false); }}
      />

      <FormDialogShell
        open={openIgnorar}
        onOpenChange={setOpenIgnorar}
        icon={EyeOff}
        title="Ignorar movimiento"
        description="Confirma que el movimiento será ignorado en la conciliación."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenIgnorar(false)}>Cancelar</Button>
            <Button onClick={onIgnorar}>Ignorar</Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Comisión bancaria, traspaso interno..." />
        </div>
      </FormDialogShell>

      <FormDialogShell
        open={openEliminar}
        onOpenChange={setOpenEliminar}
        icon={Trash2}
        title="Eliminar movimiento manual"
        description="El movimiento dejará de aparecer en la conciliación y en los totales de la cuenta. Sólo aplica a movimientos capturados a mano y no conciliados."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenEliminar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={onEliminar} disabled={eliminar.isPending}>
              Eliminar
            </Button>
          </>
        }
      >
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
          <p className="font-medium">{movimiento.concepto}</p>
          <p className="text-muted-foreground">
            {formatDate(movimiento.fecha)} · {esCargo ? "Cargo" : "Abono"} de {formatCurrency(monto, "MXN")}
          </p>
        </div>
      </FormDialogShell>
    </Card>
  );
}
