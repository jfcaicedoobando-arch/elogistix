/**
 * Editor de etapas del pipeline. Edición inline + guardar por fila.
 * Sprint C: incluye `crea_tarea_seguimiento` + `dias_seguimiento` para automatizaciones.
 */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { COLOR_ETAPA_DEFAULT } from "@/lib/chartTokens";
import { Hint } from "@/components/shared/Hint";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import {
  useActualizarEtapa, useEtapasPipelineAll, useIntercambiarOrdenEtapas,
  type CrmEtapaRow, type CrmEtapaTipo,
} from "@/features/crm/hooks";

const TIPOS: CrmEtapaTipo[] = ["abierta", "ganada", "perdida"];

interface RowState {
  nombre: string; tipo: CrmEtapaTipo; color: string;
  probabilidad_default: number; orden: number; activa: boolean;
  crea_tarea_seguimiento: boolean; dias_seguimiento: number; sla_dias: number;
}

function toState(e: CrmEtapaRow): RowState {
  return {
    nombre: e.nombre, tipo: e.tipo as CrmEtapaTipo, color: e.color ?? COLOR_ETAPA_DEFAULT,
    probabilidad_default: e.probabilidad_default ?? 0,
    orden: e.orden, activa: e.activa,
    crea_tarea_seguimiento: e.crea_tarea_seguimiento ?? false,
    dias_seguimiento: e.dias_seguimiento ?? 3,
    sla_dias: e.sla_dias ?? 7,
  };
}

export default function EtapasPipelineEditor() {
  const { data: etapas = [], isLoading } = useEtapasPipelineAll();
  const actualizar = useActualizarEtapa();
  const reordenar = useIntercambiarOrdenEtapas();
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
      orig.orden !== d.orden || orig.activa !== d.activa ||
      (orig.crea_tarea_seguimiento ?? false) !== d.crea_tarea_seguimiento ||
      (orig.dias_seguimiento ?? 3) !== d.dias_seguimiento ||
      (orig.sla_dias ?? 7) !== d.sla_dias
    );
  };

  const set = (id: string, patch: Partial<RowState>) =>
    setDraft((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const save = async (id: string) => {
    try {
      // El hook `useActualizarEtapa` ya notifica éxito y error: un solo aviso.
      await actualizar.mutateAsync({ id, patch: draft[id] });
    } catch {
      /* notificado por el hook */
    }
  };

  // Subir/bajar intercambia el orden con la etapa vecina (RPC atómica).
  // Antes sólo se sumaba ±1 al orden propio, lo que generaba órdenes duplicados.
  const mover = async (index: number, delta: number) => {
    const actual = etapas[index];
    const vecina = etapas[index + delta];
    if (!actual || !vecina || reordenar.isPending) return;
    try {
      await reordenar.mutateAsync({ etapaA: actual.id, etapaB: vecina.id });
    } catch {
      /* notificado por el hook */
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapas del pipeline</CardTitle>
        <p className="text-body-sm text-muted-foreground">
          Configura nombre, tipo, probabilidad, color y orden. Activa "Crear tarea" para auto-generar
          una tarea de seguimiento al mover una oportunidad a esta etapa. "SLA" son los días sin
          movimiento permitidos antes de marcar la oportunidad como vencida en Higiene.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <EmptyStateInline loading message="Cargando…" className="py-2" />}
        <div className="space-y-2">
          {etapas.map((e, index) => {
            const d = draft[e.id]; if (!d) return null;
            return (
              <div key={e.id} className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-2 items-center p-2 border rounded">
                <Input className="col-span-2" aria-label={`Nombre de la etapa ${d.nombre}`} value={d.nombre} onChange={(ev) => set(e.id, { nombre: ev.target.value })} />
                <Select value={d.tipo} onValueChange={(v) => set(e.id, { tipo: v as CrmEtapaTipo })}>
                  <SelectTrigger className="col-span-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Hint label="Probabilidad %">
                  <Input
                    type="number" min={0} max={100} className="col-span-1"
                    aria-label={`Probabilidad % de ${d.nombre}`}
                    value={d.probabilidad_default}
                    onChange={(ev) => set(e.id, { probabilidad_default: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })}
                  />
                </Hint>
                <Input type="color" className="col-span-1 h-9 p-1" aria-label={`Color de la etapa ${d.nombre}`} value={d.color} onChange={(ev) => set(e.id, { color: ev.target.value })} />
                <div className="col-span-2 flex items-center gap-1">
                  <Hint label="Subir">
                    <Button size="icon" variant="ghost" className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0" onClick={() => mover(index, -1)} aria-label="Subir" disabled={index === 0 || reordenar.isPending}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                  </Hint>
                  <span className="text-body-sm text-muted-foreground w-6 text-center">{e.orden}</span>
                  <Hint label="Bajar">
                    <Button size="icon" variant="ghost" className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0" onClick={() => mover(index, 1)} aria-label="Bajar" disabled={index === etapas.length - 1 || reordenar.isPending}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </Hint>
                </div>
                <Hint label="Activa">
                  <div className="col-span-1 flex flex-col items-center gap-0.5">
                    <Switch checked={d.activa} onCheckedChange={(v) => set(e.id, { activa: v })} aria-label={`Etapa ${d.nombre} activa`} />
                    <span className="text-3xs text-muted-foreground">Activa</span>
                  </div>
                </Hint>
                <Hint label="Crear tarea de seguimiento al entrar a esta etapa">
                  <div className="col-span-1 flex flex-col items-center gap-0.5">
                    <Switch checked={d.crea_tarea_seguimiento} onCheckedChange={(v) => set(e.id, { crea_tarea_seguimiento: v })} aria-label={`Crear tarea de seguimiento al entrar a ${d.nombre}`} />
                    <span className="text-3xs text-muted-foreground">Tarea</span>
                  </div>
                </Hint>
                <Hint label="Días para seguimiento">
                  <Input
                    type="number" min={1} max={30} className="col-span-1"
                    aria-label={`Días para seguimiento de ${d.nombre}`}
                    disabled={!d.crea_tarea_seguimiento}
                    value={d.dias_seguimiento}
                    onChange={(ev) => set(e.id, { dias_seguimiento: Math.max(1, Math.min(30, Number(ev.target.value) || 1)) })}
                  />
                </Hint>
                <Hint label="SLA de la etapa (días sin movimiento permitidos)">
                  <Input
                    type="number" min={1} max={120} className="col-span-1"
                    aria-label={`SLA en días de ${d.nombre}`}
                    value={d.sla_dias}
                    onChange={(ev) => set(e.id, { sla_dias: Math.max(1, Math.min(120, Number(ev.target.value) || 1)) })}
                  />
                </Hint>
                <Button
                  size="sm" className="col-span-1"
                  onClick={() => save(e.id)}
                  disabled={!isDirty(e.id) || actualizar.isPending}
                  loading={actualizar.isPending}
                >
                  {!actualizar.isPending && <Save className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
