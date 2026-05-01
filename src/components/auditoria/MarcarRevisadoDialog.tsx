import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useMarcarRevisado,
  useDesmarcarRevisado,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

interface Props {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarcarRevisadoDialog({ hallazgo, revisionExistente, open, onOpenChange }: Props) {
  const [accion, setAccion] = useState("");
  const marcar = useMarcarRevisado();
  const desmarcar = useDesmarcarRevisado();

  useEffect(() => {
    if (open) setAccion(revisionExistente?.accion_tomada ?? "");
  }, [open, revisionExistente]);

  if (!hallazgo) return null;

  const handleGuardar = async () => {
    const trimmed = accion.trim();
    if (!trimmed) return;
    await marcar.mutateAsync({ hallazgo, accionTomada: trimmed });
    onOpenChange(false);
  };

  const handleEliminar = async () => {
    if (!revisionExistente) return;
    await desmarcar.mutateAsync(revisionExistente.id);
    onOpenChange(false);
  };

  const yaRevisado = !!revisionExistente;
  const cargando = marcar.isPending || desmarcar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {yaRevisado ? "Hallazgo revisado" : "Marcar como revisado"}
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
            {hallazgo.documentos_faltantes?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {hallazgo.documentos_faltantes.map((d) => (
                  <Badge key={d} variant="secondary" className="text-[10px] font-normal">
                    {d}
                  </Badge>
                ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="accion-tomada" className="text-xs">
            Acción tomada <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="accion-tomada"
            placeholder="Describe la acción tomada para resolver o justificar este hallazgo..."
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            rows={4}
            maxLength={1000}
            className="text-sm"
          />
          <div className="text-[10px] text-muted-foreground text-right tabular-nums">
            {accion.length} / 1000
          </div>
        </div>

        {yaRevisado && revisionExistente && (
          <div className="rounded-md border bg-muted/40 p-2 text-[11px] space-y-0.5">
            <div>
              <span className="text-muted-foreground">Revisado por:</span>{" "}
              <span className="font-medium">{revisionExistente.revisado_por_email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Fecha:</span>{" "}
              <span className="tabular-nums">
                {format(new Date(revisionExistente.updated_at), "dd/MM/yyyy HH:mm")}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {yaRevisado && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEliminar}
              disabled={cargando}
              className="mr-auto text-destructive hover:text-destructive"
            >
              {desmarcar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Quitar marca"
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleGuardar}
            disabled={cargando || !accion.trim()}
          >
            {marcar.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Guardando...
              </>
            ) : yaRevisado ? (
              "Actualizar"
            ) : (
              "Marcar como revisado"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
