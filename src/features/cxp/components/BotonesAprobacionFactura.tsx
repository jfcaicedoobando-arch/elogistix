/**
 * Badge + botones de aprobación/rechazo de una factura de proveedor.
 * Solo visible/operable para roles autorizados (admin, contador, tesorero).
 *
 * v13.177.0 — Confirmación previa antes de aprobar + validación del motivo de
 * rechazo (mínimo 3, máximo 500 caracteres). Los toasts de éxito/error se
 * emiten desde `useAprobarFactura`.
 * v13.232.0 · Aprobar migrado a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { Check, X, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { useAprobarFactura } from "@/features/cxp/hooks/useAprobarFactura";
import {
  MOTIVO_RECHAZO_MAX,
  MOTIVO_RECHAZO_MIN,
  type EstadoAprobacion,
} from "@/features/cxp/services/aprobacionFactura";

interface Props {
  facturaId: string;
  estado: EstadoAprobacion;
  motivoRechazo?: string | null;
  puedeAprobar: boolean;
  /** Contexto informativo para los toasts. */
  folio?: string | null;
  proveedor?: string | null;
}

export function EstadoAprobacionBadge({ estado }: { estado: EstadoAprobacion }) {
  if (estado === "aprobada") {
    return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">
      <Check className="h-3 w-3 mr-1" /> Aprobada
    </Badge>;
  }
  if (estado === "rechazada") {
    return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Rechazada</Badge>;
  }
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>;
}

export function BotonesAprobacionFactura({
  facturaId,
  estado,
  motivoRechazo,
  puedeAprobar,
  folio,
  proveedor,
}: Props) {
  const [openRechazo, setOpenRechazo] = useState(false);
  const [openAprobar, setOpenAprobar] = useState(false);
  const aprobar = useAprobarFactura();

  const ctxLabel = [folio, proveedor].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <EstadoAprobacionBadge estado={estado} />
      {estado === "rechazada" && motivoRechazo && (
        <span className="text-xs text-muted-foreground italic">Motivo: {motivoRechazo}</span>
      )}
      {puedeAprobar && estado === "pendiente" && (
        <div className="flex gap-2 ml-auto">
          <Button
            size="sm" variant="outline"
            onClick={() => setOpenAprobar(true)}
            disabled={aprobar.isPending}
          >
            <Check className="h-4 w-4 mr-1" /> Aprobar
          </Button>
          <Button
            size="sm" variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setOpenRechazo(true)}
            disabled={aprobar.isPending}
          >
            <X className="h-4 w-4 mr-1" /> Rechazar
          </Button>
        </div>
      )}

      <ConfirmActionDialog
        open={openAprobar}
        onOpenChange={setOpenAprobar}
        title="Aprobar factura"
        titleIcon={<CheckCircle2 className="h-5 w-5 text-success" aria-hidden />}
        confirmLabel={aprobar.isPending ? "Aprobando…" : "Sí, aprobar"}
        isPending={aprobar.isPending}
        onConfirm={async () => {
          try {
            await aprobar.mutateAsync({ id: facturaId, aprobar: true, folio, proveedor });
            setOpenAprobar(false);
          } catch {
            // El toast lo emite el hook; mantener el diálogo abierto para reintento.
          }
        }}
        description={
          <>
            {ctxLabel ? <><b>{ctxLabel}</b><br /></> : null}
            Al aprobar, la factura pasará a estado <b>Vigente</b> y quedará lista para programar pago.
            Esta acción se registrará en la bitácora.
          </>
        }
      />

      <ReasonDialog
        open={openRechazo}
        onOpenChange={setOpenRechazo}
        icon={XCircle}
        title="Rechazar factura"
        description={
          ctxLabel
            ? `${ctxLabel} — Indica el motivo del rechazo. Será registrado en la bitácora y notificado al proveedor.`
            : "Indica el motivo del rechazo. Será registrado en la bitácora y notificado al proveedor."
        }
        label="Motivo"
        placeholder={`Ej. Folio incorrecto, falta XML, monto no coincide con presupuesto... (máx. ${MOTIVO_RECHAZO_MAX} caracteres)`}
        confirmLabel="Rechazar factura"
        minLength={MOTIVO_RECHAZO_MIN}
        pending={aprobar.isPending}
        onConfirm={async (motivo) => {
          try {
            await aprobar.mutateAsync({
              id: facturaId,
              aprobar: false,
              motivo,
              folio,
              proveedor,
            });
            setOpenRechazo(false);
          } catch {
            // El toast lo emite el hook; mantener el diálogo abierto para permitir corregir.
          }
        }}
      />
    </div>
  );
}
