/**
 * Diálogo de asignación de responsable a un hallazgo de auditoría.
 * Soporta: asignar a otro usuario, "tomarlo" uno mismo, fijar fecha límite y quitar asignación.
 */
import { useEffect, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useAsignarResponsable, useOrgMembersAsignables } from "@/hooks/auditoria";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

interface Props {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIN_RESPONSABLE = "__sin__";

export function AsignarResponsableDialog({
  hallazgo,
  revisionExistente,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const { data: asignables = [], isLoading: loadingUsers } = useOrgMembersAsignables();
  const asignar = useAsignarResponsable();

  const [responsableId, setResponsableId] = useState<string>(SIN_RESPONSABLE);
  const [fechaLimite, setFechaLimite] = useState<Date | undefined>();

  useEffect(() => {
    if (!open) return;
    setResponsableId(revisionExistente?.responsable_id ?? SIN_RESPONSABLE);
    setFechaLimite(
      revisionExistente?.fecha_limite
        ? new Date(`${revisionExistente.fecha_limite}T00:00:00`)
        : undefined,
    );
  }, [open, revisionExistente]);

  if (!hallazgo) return null;

  const optEmail = (id: string) =>
    asignables.find((a) => a.id === id)?.email ?? "";

  const submit = async (tomar = false) => {
    const id = tomar ? user?.id ?? null : responsableId === SIN_RESPONSABLE ? null : responsableId;
    const email = tomar
      ? user?.email ?? ""
      : id
        ? optEmail(id) || revisionExistente?.responsable_email || ""
        : "";
    await asignar.mutateAsync({
      hallazgo,
      responsableId: id,
      responsableEmail: email,
      fechaLimite: fechaLimite ? format(fechaLimite, "yyyy-MM-dd") : null,
      tomar,
    });
    onOpenChange(false);
  };

  const yaAsignado = !!revisionExistente?.responsable_id;
  const cargando = asignar.isPending;
  const yoSoyResponsable = revisionExistente?.responsable_id === user?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {yaAsignado ? "Reasignar responsable" : "Asignar responsable"}
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
            <Select value={responsableId} onValueChange={setResponsableId} disabled={loadingUsers}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={loadingUsers ? "Cargando..." : "Selecciona un responsable"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_RESPONSABLE}>— Sin responsable —</SelectItem>
                {asignables.map((u) => (
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
                    !fechaLimite && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {fechaLimite
                    ? format(fechaLimite, "dd/MM/yyyy", { locale: es })
                    : "Sin fecha límite"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaLimite}
                  onSelect={setFechaLimite}
                  initialFocus
                  locale={es}
                />
                {fechaLimite && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setFechaLimite(undefined)}
                    >
                      Quitar fecha
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {yaAsignado && revisionExistente && (
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
          {!yoSoyResponsable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => submit(true)}
              disabled={cargando}
              className="mr-auto gap-1.5"
            >
              <Hand className="h-3.5 w-3.5" />
              Tomarlo yo
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={cargando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => submit(false)} disabled={cargando}>
            {cargando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Guardando...
              </>
            ) : yaAsignado ? (
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
