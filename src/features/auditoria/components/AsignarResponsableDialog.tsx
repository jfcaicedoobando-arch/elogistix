/**
 * Diálogo de asignación de responsable a un hallazgo de auditoría.
 * Pura presentación: la lógica vive en `useAsignarResponsableController`.
 */
import { Hand, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import {
  SIN_RESPONSABLE,
  useAsignarResponsableController,
} from "@/features/auditoria/hooks";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";
import { AsignacionExistenteInfo } from "@/features/auditoria/components/asignarResponsable/AsignacionExistenteInfo";
import { FechaLimitePicker } from "@/features/auditoria/components/asignarResponsable/FechaLimitePicker";

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

  const description = (
    <span className="block space-y-1">
      <span className="block">
        <span className="font-medium text-foreground">Expediente:</span>{" "}
        <span className="tabular-nums">{hallazgo.expediente}</span>
      </span>
      <span className="block">
        <span className="font-medium text-foreground">Cliente:</span>{" "}
        {hallazgo.cliente_nombre || "—"}
      </span>
      <span className="block text-foreground/80 pt-1">{hallazgo.detalle}</span>
    </span>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserPlus}
      title={ctrl.yaAsignado ? "Reasignar responsable" : "Asignar responsable"}
      description={description}
      size="lg"
      footer={
        <>
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
        </>
      }
    >
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
                  <span className="text-muted-foreground text-2xs ml-1">({u.role})</span>
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
    </FormDialogShell>
  );
}
