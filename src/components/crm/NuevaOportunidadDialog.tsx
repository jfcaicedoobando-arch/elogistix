/**
 * Diálogo para crear / editar una Oportunidad CRM (Fase 3).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import {
  useCrearOportunidad,
  useActualizarOportunidad,
  type CrmOportunidadRow,
  type Moneda,
} from "@/hooks/crm/useOportunidades";
import { useEtapasPipeline } from "@/hooks/crm/useEtapasPipeline";
import { useClientesForSelect } from "@/hooks/cliente";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidad?: CrmOportunidadRow | null;
  onSaved?: (id: string) => void;
}

const EMPTY = {
  nombre: "",
  cliente_id: null as string | null,
  cliente_nombre: "",
  etapa_id: "",
  monto_estimado: 0,
  moneda: "MXN" as Moneda,
  probabilidad: 0,
  fecha_estimada_cierre: "",
  modo: "",
  origen: "",
  destino: "",
  notas: "",
};

export default function NuevaOportunidadDialog({ open, onOpenChange, oportunidad, onSaved }: Props) {
  const isEdit = !!oportunidad;
  const [form, setForm] = useState(EMPTY);
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect();
  const crear = useCrearOportunidad();
  const actualizar = useActualizarOportunidad();
  const { toast } = useToast();

  useEffect(() => {
    if (oportunidad) {
      setForm({
        nombre: oportunidad.nombre,
        cliente_id: oportunidad.cliente_id ?? null,
        cliente_nombre: oportunidad.cliente_nombre ?? "",
        etapa_id: oportunidad.etapa_id,
        monto_estimado: Number(oportunidad.monto_estimado ?? 0),
        moneda: (oportunidad.moneda as Moneda) ?? "MXN",
        probabilidad: oportunidad.probabilidad ?? 0,
        fecha_estimada_cierre: oportunidad.fecha_estimada_cierre ?? "",
        modo: oportunidad.modo ?? "",
        origen: oportunidad.origen ?? "",
        destino: oportunidad.destino ?? "",
        notas: oportunidad.notas ?? "",
      });
    } else if (open) {
      const primera = etapas[0];
      setForm({ ...EMPTY, etapa_id: primera?.id ?? "", probabilidad: primera?.probabilidad_default ?? 0 });
    }
  }, [oportunidad, open, etapas]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return notifyError(toast, { title: "Nombre es obligatorio" });
    if (!form.etapa_id) return notifyError(toast, { title: "Selecciona una etapa" });
    try {
      const payload = {
        nombre: form.nombre,
        cliente_id: form.cliente_id,
        cliente_nombre: form.cliente_nombre,
        etapa_id: form.etapa_id,
        monto_estimado: form.monto_estimado,
        moneda: form.moneda,
        probabilidad: form.probabilidad,
        fecha_estimada_cierre: form.fecha_estimada_cierre || null,
        modo: form.modo,
        origen: form.origen,
        destino: form.destino,
        notas: form.notas,
      };
      if (isEdit && oportunidad) {
        await actualizar.mutateAsync({ id: oportunidad.id, patch: payload });
        notifySuccess(toast, { title: "Oportunidad actualizada" });
        onSaved?.(oportunidad.id);
      } else {
        const r = await crear.mutateAsync(payload);
        notifySuccess(toast, { title: "Oportunidad creada" });
        onSaved?.(r.id);
      }
      onOpenChange(false);
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle>
          <DialogDescription>Captura los datos comerciales y la etapa del pipeline.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cliente</Label>
            <Select
              value={form.cliente_id ?? "ninguno"}
              onValueChange={(v) => {
                if (v === "ninguno") { set("cliente_id", null); set("cliente_nombre", ""); return; }
                const c = clientes.find((x) => x.id === v);
                set("cliente_id", v);
                set("cliente_nombre", c?.nombre ?? "");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin cliente</SelectItem>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Etapa *</Label>
            <Select
              value={form.etapa_id}
              onValueChange={(v) => {
                set("etapa_id", v);
                const et = etapas.find((e) => e.id === v);
                if (et) set("probabilidad", et.probabilidad_default);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Etapa..." /></SelectTrigger>
              <SelectContent>
                {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto estimado</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.monto_estimado}
              onChange={(e) => set("monto_estimado", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={form.moneda} onValueChange={(v) => set("moneda", v as Moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Probabilidad (%)</Label>
            <Input
              type="number" min={0} max={100}
              value={form.probabilidad}
              onChange={(e) => set("probabilidad", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha estimada cierre</Label>
            <Input type="date" value={form.fecha_estimada_cierre} onChange={(e) => set("fecha_estimada_cierre", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Modo</Label>
            <Input value={form.modo} onChange={(e) => set("modo", e.target.value)} placeholder="Marítimo / Aéreo..." />
          </div>
          <div className="space-y-1">
            <Label>Origen</Label>
            <Input value={form.origen} onChange={(e) => set("origen", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Destino</Label>
            <Input value={form.destino} onChange={(e) => set("destino", e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Notas</Label>
            <Textarea rows={3} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear oportunidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
