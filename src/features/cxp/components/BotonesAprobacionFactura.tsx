/**
 * Badge + botones de aprobación/rechazo de una factura de proveedor.
 * Solo visible/operable para roles autorizados (admin, contador, tesorero).
 * El rechazo abre un ReasonDialog pidiendo motivo.
 */
import { useState } from "react";
import { Check, X, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { useAprobarFactura } from "@/features/cxp/hooks/useAprobarFactura";
import type { EstadoAprobacion } from "@/features/cxp/services/aprobacionFactura";

interface Props {
  facturaId: string;
  estado: EstadoAprobacion;
  motivoRechazo?: string | null;
  puedeAprobar: boolean;
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

export function BotonesAprobacionFactura({ facturaId, estado, motivoRechazo, puedeAprobar }: Props) {
  const [openRechazo, setOpenRechazo] = useState(false);
  const aprobar = useAprobarFactura();

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
            onClick={() => aprobar.mutate({ id: facturaId, aprobar: true })}
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

      <ReasonDialog
        open={openRechazo}
        onOpenChange={setOpenRechazo}
        icon={XCircle}
        title="Rechazar factura"
        description="Indica el motivo del rechazo. Será registrado en la bitácora."
        label="Motivo"
        placeholder="Ej. Folio incorrecto, falta XML, monto no coincide con presupuesto..."
        confirmLabel="Rechazar factura"
        minLength={3}
        pending={aprobar.isPending}
        onConfirm={async (motivo) => {
          await aprobar.mutateAsync({ id: facturaId, aprobar: false, motivo });
          setOpenRechazo(false);
        }}
      />
    </div>
  );
}
