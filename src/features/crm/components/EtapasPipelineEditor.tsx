/**
 * Editor de etapas del pipeline. Edición inline + guardar por fila.
 * Sprint C: incluye `crea_tarea_seguimiento` + `dias_seguimiento` para automatizaciones.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import {
  mergeDrafts, sameState, serverSnapshot, toState, type RowState,
} from "./etapasPipelineDraft";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import {
  useActualizarEtapa, useEtapasPipelineAll, useIntercambiarOrdenEtapas,
  type CrmEtapaTipo,
} from "@/features/crm/hooks";

const TIPOS: CrmEtapaTipo[] = ["abierta", "ganada", "perdida"];
const TIPO_LABEL: Record<CrmEtapaTipo, string> = {
  abierta: "Abierta", ganada: "Ganada", perdida: "Perdida",
};

/**
 * VIS-249-04 — Campo con rótulo visible breve. Antes la fila era una rejilla de
 * 13 fracciones: el selector de tipo quedaba en ~58 px (truncaba "abierta"/
 * "ganada") y los numéricos sólo tenían aria-label/Hint. Ahora cada etapa usa
 * dos líneas que caben a 1280 px con el menú lateral abierto.
 */
function Campo({ label, className, children }: {
  label: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <span className="block text-3xs text-muted-foreground mb-0.5">{label}</span>
      {children}
    </div>
  );
}

export default function EtapasPipelineEditor() {
  const { data: etapas = [], isLoading } = useEtapasPipelineAll();
  const actualizar = useActualizarEtapa();
  const reordenar = useIntercambiarOrdenEtapas();
  const [draft, setDraft] = useState<Record<string, RowState>>({});

  // Snapshot del backend con el que se hidrató el borrador actual.
  const baseRef = useRef<Record<string, RowState>>({});

  useEffect(() => {
    setDraft((prev) => mergeDrafts(prev, baseRef.current, etapas));
    baseRef.current = serverSnapshot(etapas);
  }, [etapas]);

  const isDirty = (id: string) => {
    const orig = etapas.find((e) => e.id === id);
    const d = draft[id];
    if (!orig || !d) return false;
    return !sameState(toState(orig), d);
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
              <EtapasPipelineFila
                key={e.id}
                d={d}
                orden={e.orden}
                dirty={isDirty(e.id)}
                guardando={actualizar.isPending}
                reordenando={reordenar.isPending}
                puedeSubir={index > 0}
                puedeBajar={index < etapas.length - 1}
                set={(patch) => set(e.id, patch)}
                onGuardar={() => save(e.id)}
                onMover={(delta) => mover(index, delta)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
