/**
 * VIS-249-04 — Una etapa del pipeline en dos líneas.
 *
 * Antes la fila era una rejilla de 13 fracciones: el selector de tipo quedaba
 * en ~58 px y truncaba "abierta"/"ganada", y probabilidad, seguimiento y SLA
 * sólo tenían aria-label/Hint (sin rótulo visible). Ahora todo cabe a 1280 px
 * con el menú lateral abierto, con etiquetas breves visibles y nombre
 * accesible del selector por etapa. Reglas de negocio, guardado por fila y
 * reordenamiento sin cambios.
 */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { RowState } from "./etapasPipelineDraft";
import type { CrmEtapaTipo } from "@/features/crm/hooks";

const TIPOS: CrmEtapaTipo[] = ["abierta", "ganada", "perdida"];
const TIPO_LABEL: Record<CrmEtapaTipo, string> = {
  abierta: "Abierta", ganada: "Ganada", perdida: "Perdida",
};

function Campo({ label, className, children }: {
  label: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={className}>
      <span className="block text-3xs text-muted-foreground mb-0.5">{label}</span>
      {children}
    </div>
  );
}

interface Props {
  d: RowState;
  orden: number;
  dirty: boolean;
  guardando: boolean;
  reordenando: boolean;
  puedeSubir: boolean;
  puedeBajar: boolean;
  set: (patch: Partial<RowState>) => void;
  onGuardar: () => void;
  onMover: (delta: number) => void;
}

export function EtapasPipelineFila({
  d, orden, dirty, guardando, reordenando, puedeSubir, puedeBajar,
  set, onGuardar, onMover,
}: Props) {
  const btnMover = "min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0";
  return (
    <div className="p-2 border rounded space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Nombre" className="flex-1 min-w-[200px]">
          <Input
            aria-label={`Nombre de la etapa ${d.nombre}`}
            value={d.nombre}
            onChange={(ev) => set({ nombre: ev.target.value })}
          />
        </Campo>
        <Campo label="Tipo" className="w-36">
          <Select value={d.tipo} onValueChange={(v) => set({ tipo: v as CrmEtapaTipo })}>
            <SelectTrigger aria-label={`Tipo de la etapa ${d.nombre}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Color" className="w-16">
          <Input
            type="color" className="h-9 p-1"
            aria-label={`Color de la etapa ${d.nombre}`}
            value={d.color}
            onChange={(ev) => set({ color: ev.target.value })}
          />
        </Campo>
        <Campo label="Orden" className="w-auto">
          <div className="flex items-center gap-1 h-9">
            <Hint label="Subir">
              <Button size="icon" variant="ghost" className={btnMover} onClick={() => onMover(-1)} aria-label="Subir" disabled={!puedeSubir || reordenando}>
                <ArrowUp className="size-3" />
              </Button>
            </Hint>
            <span className="text-body-sm text-muted-foreground w-6 text-center">{orden}</span>
            <Hint label="Bajar">
              <Button size="icon" variant="ghost" className={btnMover} onClick={() => onMover(1)} aria-label="Bajar" disabled={!puedeBajar || reordenando}>
                <ArrowDown className="size-3" />
              </Button>
            </Hint>
          </div>
        </Campo>
        <Button
          size="sm" className="h-9"
          onClick={onGuardar}
          disabled={!dirty || guardando}
          loading={guardando}
          aria-label={`Guardar cambios de ${d.nombre}`}
        >
          {!guardando && <Save className="size-4" />}
          <span>Guardar</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Campo label="Prob. %" className="w-20">
          <Input
            type="number" min={0} max={100}
            aria-label={`Probabilidad % de ${d.nombre}`}
            value={d.probabilidad_default}
            onChange={(ev) => set({ probabilidad_default: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })}
          />
        </Campo>
        <Campo label="Seguimiento: días" className="w-32">
          <Input
            type="number" min={1} max={30}
            aria-label={`Días para seguimiento de ${d.nombre}`}
            disabled={!d.crea_tarea_seguimiento}
            value={d.dias_seguimiento}
            onChange={(ev) => set({ dias_seguimiento: Math.max(1, Math.min(30, Number(ev.target.value) || 1)) })}
          />
        </Campo>
        <Campo label="SLA: días" className="w-24">
          <Hint label="Días sin movimiento permitidos antes de marcarla vencida en Higiene">
            <Input
              type="number" min={1} max={120}
              aria-label={`SLA en días de ${d.nombre}`}
              value={d.sla_dias}
              onChange={(ev) => set({ sla_dias: Math.max(1, Math.min(120, Number(ev.target.value) || 1)) })}
            />
          </Hint>
        </Campo>
        <div className="flex items-center gap-2 h-9">
          <Switch checked={d.activa} onCheckedChange={(v) => set({ activa: v })} aria-label={`Etapa ${d.nombre} activa`} />
          <span className="text-body-sm text-muted-foreground">Activa</span>
        </div>
        <Hint label="Crear tarea de seguimiento al entrar a esta etapa">
          <div className="flex items-center gap-2 h-9">
            <Switch checked={d.crea_tarea_seguimiento} onCheckedChange={(v) => set({ crea_tarea_seguimiento: v })} aria-label={`Crear tarea de seguimiento al entrar a ${d.nombre}`} />
            <span className="text-body-sm text-muted-foreground">Crear tarea</span>
          </div>
        </Hint>
      </div>
    </div>
  );
}
