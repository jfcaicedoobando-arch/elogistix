/**
 * Badge + botones de aprobación/rechazo de una factura de proveedor.
 * Solo visible/operable para roles autorizados (admin, contador, tesorero).
 * El rechazo abre un dialog modal pidiendo motivo.
 */
import { useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20">
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
  const [motivo, setMotivo] = useState("");
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

      <Dialog open={openRechazo} onOpenChange={setOpenRechazo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar factura</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo. Será registrado en la bitácora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Ej. Folio incorrecto, falta XML, monto no coincide con presupuesto..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRechazo(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 3 || aprobar.isPending}
              onClick={async () => {
                await aprobar.mutateAsync({ id: facturaId, aprobar: false, motivo: motivo.trim() });
                setOpenRechazo(false);
                setMotivo("");
              }}
            >
              Rechazar factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
