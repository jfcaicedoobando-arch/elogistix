/**
 * Editor de etapas del pipeline. Edición inline + guardar por fila.
 */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  useActualizarEtapa, useEtapasPipelineAll,
  type CrmEtapaRow, type CrmEtapaTipo,
} from "@/hooks/crm/useEtapasPipeline";

const TIPOS: CrmEtapaTipo[] = ["abierta", "ganada", "perdida"];

interface RowState {
  nombre: string; tipo: CrmEtapaTipo; color: string;
  probabilidad_default: number; orden: number; activa: boolean;
}

function toState(e: CrmEtapaRow): RowState {
  return {
    nombre: e.nombre, tipo: e.tipo as CrmEtapaTipo, color: e.color ?? "#888",
    probabilidad_default: e.probabilidad_default ?? 0,
    orden: e.orden, activa: e.activa,
  };
}

export default function EtapasPipelineEditor() {
  const { toast } = useToast();
  const { data: etapas = [], isLoading } = useEtapasPipelineAll();
  const actualizar = useActualizarEtapa();
  const [draft, setDraft] = useState<Record<string, RowState>>({});

  useEffect(() => {
    setDraft(Object.fromEntries(etapas.map((e) => [e.id, toState(e)])));
  }, [etapas]);

  const isDirty = (id: string) => {
    const orig = etapas.find((e) => e.id === id);
    const d = draft[id];
    if (!orig || !d) return false;
    return (
      orig.nombre !== d.nombre || orig.tipo !== d.tipo || orig.color !== d.color ||
      (orig.probabilidad_default ?? 0) !== d.probabilidad_default ||
      orig.orden !== d.orden || orig.activa !== d.activa
    );
  };

  const set = (id: string, patch: Partial<RowState>) =>
    setDraft((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const save = async (id: string) => {
    try {
      await actualizar.mutateAsync({ id, patch: draft[id] });
      notifySuccess(toast, { title: "Etapa actualizada" });
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  const mover = async (id: string, delta: number) => {
    const d = draft[id]; if (!d) return;
    try {
      await actualizar.mutateAsync({ id, patch: { orden: d.orden + delta } });
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Etapas del pipeline</CardTitle></CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        <div className="space-y-2">
          {etapas.map((e) => {
            const d = draft[e.id]; if (!d) return null;
            return (
              <div key={e.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded">
                <Input className="col-span-3" value={d.nombre} onChange={(ev) => set(e.id, { nombre: ev.target.value })} />
                <Select value={d.tipo} onValueChange={(v) => set(e.id, { tipo: v as CrmEtapaTipo })}>
                  <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number" min={0} max={100} className="col-span-1"
                  value={d.probabilidad_default}
                  onChange={(ev) => set(e.id, { probabilidad_default: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })}
                />
                <Input type="color" className="col-span-1 h-9 p-1" value={d.color} onChange={(ev) => set(e.id, { color: ev.target.value })} />
                <div className="col-span-2 flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => mover(e.id, -1)} title="Subir">
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-6 text-center">{e.orden}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => mover(e.id, 1)} title="Bajar">
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="col-span-1 flex justify-center">
                  <Switch checked={d.activa} onCheckedChange={(v) => set(e.id, { activa: v })} />
                </div>
                <Button
                  size="sm" className="col-span-2"
                  onClick={() => save(e.id)}
                  disabled={!isDirty(e.id) || actualizar.isPending}
                >
                  {actualizar.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Guardar
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
