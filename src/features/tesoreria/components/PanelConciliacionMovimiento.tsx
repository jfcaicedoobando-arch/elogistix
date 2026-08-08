import { useState } from "react";
import { EyeOff, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
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
import {
  EstadoConciliado, EstadoIgnorado, ListaCandidatos,
} from "@/features/tesoreria/components/PanelConciliacionEstados";
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
          <EstadoConciliado
            tienePago={!!refPago}
            onVerPago={() => setVerPago(true)}
            onDesconciliar={onDesconciliar}
          />
        ) : movimiento.estado_conciliacion === "Ignorado" ? (
          <EstadoIgnorado motivo={movimiento.motivo_ignorar} onReactivar={onDesconciliar} />
        ) : (
          <ListaCandidatos
            candidatos={candidatos}
            isLoading={isLoading}
            isPending={conciliar.isPending}
            onConciliar={onConciliar}
            onIgnorar={() => setOpenIgnorar(true)}
          />
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
