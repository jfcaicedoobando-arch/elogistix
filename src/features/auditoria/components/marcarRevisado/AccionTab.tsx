import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { formatFechaHoraCorta } from "@/lib/formatters";
import type { useMarcarRevisadoController } from "@/features/auditoria/hooks";
import type { AuditoriaRevision } from "@/features/auditoria/types";

interface Props {
  ctrl: ReturnType<typeof useMarcarRevisadoController>;
  revisionExistente: AuditoriaRevision | null;
}

export function AccionTab({ ctrl, revisionExistente }: Props) {
  return (
    <TabsContent value="accion" className="space-y-2 mt-2">
      <Label htmlFor="accion-tomada">
        Acción tomada <span className="text-destructive">*</span>
      </Label>
      <Textarea
        id="accion-tomada"
        placeholder="Describe la acción tomada para resolver o justificar este hallazgo…"
        value={ctrl.accion}
        onChange={(e) => ctrl.setAccion(e.target.value)}
        rows={4}
        maxLength={1000}
        className="text-body"
      />
      <div className="text-label text-muted-foreground text-right tabular-nums">
        {ctrl.accion.length} / 1000
      </div>

      {ctrl.yaRevisado && revisionExistente && (
        <div className="rounded-md border bg-muted/40 p-2 text-label space-y-0.5">
          <div>
            <span className="text-muted-foreground">Revisado por:</span>{" "}
            <span className="font-medium">{revisionExistente.revisado_por_email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Fecha:</span>{" "}
            <span className="tabular-nums">
              {formatFechaHoraCorta(revisionExistente.updated_at)}
            </span>
          </div>
        </div>
      )}
    </TabsContent>
  );
}

// Botón "Guardar" del footer: re-exporta el handler para mantener acoplamiento bajo.
export function AccionButton({ ctrl }: { ctrl: ReturnType<typeof useMarcarRevisadoController> }) {
  return (
    <Button size="sm" onClick={ctrl.handleGuardar} disabled={ctrl.cargando || !ctrl.accion.trim()}>
      {ctrl.marcando ? "Guardando…" : ctrl.yaRevisado ? "Actualizar" : "Marcar como revisado"}
    </Button>
  );
}
