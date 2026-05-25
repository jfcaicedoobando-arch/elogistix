/**
 * Editor de motivos de pérdida (activar/desactivar + crear).
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  useMotivosPerdida, useActualizarMotivoPerdida, useCrearMotivoPerdida,
} from "@/hooks/crm/useEtapasPipeline";

export default function MotivosPerdidaEditor() {
  const { toast } = useToast();
  const { data: motivos = [] } = useMotivosPerdida(false);
  const actualizar = useActualizarMotivoPerdida();
  const crear = useCrearMotivoPerdida();
  const [nuevo, setNuevo] = useState("");

  const toggle = async (id: string, activa: boolean) => {
    try { await actualizar.mutateAsync({ id, patch: { activa } }); }
    catch (e) { notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined }); }
  };

  const handleCrear = async () => {
    const n = nuevo.trim();
    if (!n) return;
    try {
      await crear.mutateAsync(n);
      notifySuccess(toast, { title: "Motivo agregado" });
      setNuevo("");
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Motivos de pérdida</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Nuevo motivo..." value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          <Button onClick={handleCrear} disabled={!nuevo.trim() || crear.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-1">
          {motivos.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-sm">{m.nombre}</span>
              <Switch checked={m.activa} onCheckedChange={(v) => toggle(m.id, v)} />
            </div>
          ))}
          {motivos.length === 0 && <p className="text-xs text-muted-foreground">Sin motivos configurados.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
