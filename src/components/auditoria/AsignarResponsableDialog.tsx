/**
 * Diálogo de asignación de responsable a un hallazgo de auditoría.
 * Pura presentación: la lógica vive en `useAsignarResponsableController`.
 */
import { Hand, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SIN_RESPONSABLE,
  useAsignarResponsableController,
} from "@/hooks/auditoria";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";
import { AsignacionExistenteInfo } from "@/components/auditoria/asignarResponsable/AsignacionExistenteInfo";
import { FechaLimitePicker } from "@/components/auditoria/asignarResponsable/FechaLimitePicker";

interface Props {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AsignarResponsableDialog({
  hallazgo,
  revisionExistente,
  open,
  onOpenChange,
}: Props) {
  const ctrl = useAsignarResponsableController({
    hallazgo,
    revisionExistente,
    open,
    onClose: () => onOpenChange(false),
  });

  if (!hallazgo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {ctrl.yaAsignado ? "Reasignar responsable" : "Asignar responsable"}
          </DialogTitle>
          <DialogDescription className="text-xs space-y-1 pt-1">
            <div>
              <span className="font-medium text-foreground">Expediente:</span>{" "}
              <span className="tabular-nums">{hallazgo.expediente}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Cliente:</span>{" "}
              {hallazgo.cliente_nombre || "—"}
            </div>
            <div className="text-foreground/80 pt-1">{hallazgo.detalle}</div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Responsable</Label>
            <Select
              value={ctrl.responsableId}
              onValueChange={ctrl.setResponsableId}
              disabled={ctrl.loadingUsers}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={ctrl.loadingUsers ? "Cargando..." : "Selecciona un responsable"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_RESPONSABLE}>— Sin responsable —</SelectItem>
                {ctrl.asignables.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.email}{" "}
                    <span className="text-muted-foreground text-[10px] ml-1">({u.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FechaLimitePicker
            fechaLimite={ctrl.fechaLimite}
            onChange={ctrl.setFechaLimite}
          />

          {ctrl.yaAsignado && revisionExistente && (
            <AsignacionExistenteInfo revisionExistente={revisionExistente} />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {!ctrl.yoSoyResponsable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => ctrl.submit(true)}
              disabled={ctrl.cargando}
              className="mr-auto gap-1.5"
            >
              <Hand className="h-3.5 w-3.5" />
              Tomarlo yo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={ctrl.cargando}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={() => ctrl.submit(false)} disabled={ctrl.cargando}>
            {ctrl.cargando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Guardando...
              </>
            ) : ctrl.yaAsignado ? (
              "Actualizar"
            ) : (
              "Asignar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
