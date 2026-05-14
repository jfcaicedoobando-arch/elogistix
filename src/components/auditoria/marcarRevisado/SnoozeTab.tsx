import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { useMarcarRevisadoController } from "@/hooks/auditoria/useMarcarRevisadoController";

interface Props {
  ctrl: ReturnType<typeof useMarcarRevisadoController>;
}

export function SnoozeTab({ ctrl }: Props) {
  return (
    <TabsContent value="snooze" className="space-y-2 mt-2">
      <p className="text-xs text-muted-foreground">
        Silencia este hallazgo hasta una fecha. Sigue contando como pendiente en histórico,
        pero deja de mostrarse en la tabla por defecto.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="snooze-hasta" className="text-xs">
            Silenciar hasta <span className="text-destructive">*</span>
          </Label>
          <Input
            id="snooze-hasta"
            type="date"
            min={ctrl.minSnoozeDate}
            value={ctrl.snoozeHasta}
            onChange={(e) => ctrl.setSnoozeHasta(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="snooze-motivo" className="text-xs">
          Motivo <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="snooze-motivo"
          placeholder="Por qué se silencia (ej. esperando documentación del cliente)..."
          value={ctrl.snoozeMotivo}
          onChange={(e) => ctrl.setSnoozeMotivo(e.target.value)}
          rows={2}
          maxLength={300}
          className="text-sm"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={ctrl.handleSnooze}
          disabled={!ctrl.snoozeHasta || !ctrl.snoozeMotivo.trim() || ctrl.snoozeando}
        >
          {ctrl.snoozeando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Silenciar"}
        </Button>
        {ctrl.snoozeActivo && (
          <Button variant="outline" size="sm" onClick={ctrl.handleQuitarSnooze} disabled={ctrl.cargando}>
            Quitar snooze
          </Button>
        )}
      </div>
    </TabsContent>
  );
}
