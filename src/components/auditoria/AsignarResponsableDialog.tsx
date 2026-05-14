/**
 * Diálogo de asignación de responsable a un hallazgo de auditoría.
 * Pura presentación: la lógica vive en `useAsignarResponsableController`.
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Hand, Loader2, UserPlus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  SIN_RESPONSABLE,
  useAsignarResponsableController,
} from "@/hooks/auditoria/useAsignarResponsableController";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

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

          <div className="space-y-1.5">
            <Label className="text-xs">Fecha límite (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-xs h-9",
                    !ctrl.fechaLimite && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {ctrl.fechaLimite
                    ? format(ctrl.fechaLimite, "dd/MM/yyyy", { locale: es })
                    : "Sin fecha límite"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={ctrl.fechaLimite}
                  onSelect={ctrl.setFechaLimite}
                  initialFocus
                  locale={es}
                />
                {ctrl.fechaLimite && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => ctrl.setFechaLimite(undefined)}
                    >
                      Quitar fecha
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {ctrl.yaAsignado && revisionExistente && (
            <div className="rounded-md border bg-muted/40 p-2 text-[11px] space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Estado actual:</span>{" "}
                <Badge variant="outline" className="text-[10px] capitalize">
                  {revisionExistente.estado_revision.replace("_", " ")}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Responsable:</span>{" "}
                <span className="font-medium">{revisionExistente.responsable_email}</span>
              </div>
              {revisionExistente.asignado_por_email && (
                <div>
                  <span className="text-muted-foreground">Asignado por:</span>{" "}
                  <span>{revisionExistente.asignado_por_email}</span>
                  {revisionExistente.asignado_at && (
                    <span className="text-muted-foreground tabular-nums">
                      {" "}
                      · {format(new Date(revisionExistente.asignado_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  )}
                </div>
              )}
              {revisionExistente.fecha_limite && (
                <div>
                  <span className="text-muted-foreground">Fecha límite:</span>{" "}
                  <span className="tabular-nums">
                    {format(new Date(`${revisionExistente.fecha_limite}T00:00:00`), "dd/MM/yyyy")}
                  </span>
                </div>
              )}
            </div>
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
