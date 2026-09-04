/**
 * Editor de motivos de pérdida (activar/desactivar + crear).
 */
import { useState } from "react";
import { Plus, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import {
  useMotivosPerdida, useActualizarMotivoPerdida, useCrearMotivoPerdida,
} from "@/features/crm/hooks";

export default function MotivosPerdidaEditor() {
  const { data: motivos = [] } = useMotivosPerdida(false);
  const actualizar = useActualizarMotivoPerdida();
  const crear = useCrearMotivoPerdida();
  const [nuevo, setNuevo] = useState("");

  // El feedback (éxito/error) lo emiten los hooks de mutación; aquí sólo se
  // limpia el campo cuando la creación fue exitosa para no duplicar toasts.
  const toggle = (id: string, activa: boolean) => {
    actualizar.mutate({ id, patch: { activa } });
  };

  const handleCrear = () => {
    const n = nuevo.trim();
    if (!n) return;
    crear.mutate(n, { onSuccess: () => setNuevo("") });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Motivos de pérdida</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input aria-label="Nuevo motivo" placeholder="Nuevo motivo…" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          <Button onClick={handleCrear} disabled={!nuevo.trim() || crear.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-1">
          {motivos.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-2 border rounded">
              <span className="text-body">{m.nombre}</span>
              <Switch checked={m.activa} onCheckedChange={(v) => toggle(m.id, v)} aria-label={m.activa ? `Desactivar motivo ${m.nombre}` : `Activar motivo ${m.nombre}`} />
            </div>
          ))}
          {motivos.length === 0 && <EmptyStateInline icon={TrendingDown} message="Sin motivos configurados." className="py-3" />}
        </div>
      </CardContent>
    </Card>
  );
}
