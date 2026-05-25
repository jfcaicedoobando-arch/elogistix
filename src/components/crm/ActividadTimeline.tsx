/**
 * ActividadTimeline — timeline + alta rápida de actividades polimórficas.
 */
import { useState } from "react";
import { Activity, Check, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import {
  useActividades, useCrearActividad, useCompletarActividad,
  ACTIVIDAD_TIPOS, type CrmActividadTipo, type CrmEntidadTipo,
} from "@/hooks/crm/useActividades";

interface Props {
  entidadTipo: CrmEntidadTipo;
  entidadId: string;
}

export default function ActividadTimeline({ entidadTipo, entidadId }: Props) {
  const { toast } = useToast();
  const { data } = useActividades({ entidadTipo, entidadId, estado: "todas", pageSize: 100 });
  const crear = useCrearActividad();
  const completar = useCompletarActividad();
  const [tipo, setTipo] = useState<CrmActividadTipo>("nota");
  const [asunto, setAsunto] = useState("");
  const [desc, setDesc] = useState("");

  const items = data?.data ?? [];

  const handleCrear = async () => {
    if (!asunto.trim()) return notifyError(toast, { title: "Asunto requerido" });
    try {
      await crear.mutateAsync({ tipo, asunto, descripcion: desc, entidad_tipo: entidadTipo, entidad_id: entidadId });
      notifySuccess(toast, { title: "Actividad registrada" });
      setAsunto(""); setDesc("");
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Actividades</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[140px,1fr,auto] gap-2">
          <Select value={tipo} onValueChange={(v) => setTipo(v as CrmActividadTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVIDAD_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Asunto..." value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          <Button onClick={handleCrear} disabled={crear.isPending}>
            {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
          <Textarea
            className="md:col-span-3"
            rows={2}
            placeholder="Descripción (opcional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin actividades registradas</p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className="border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px]">{a.tipo}</Badge>
                  <span className="font-medium">{a.asunto}</span>
                  {a.fecha_completada && <Badge variant="secondary" className="text-[10px]">Completada</Badge>}
                </div>
                {a.descripcion && <div className="text-xs text-muted-foreground mt-1">{a.descripcion}</div>}
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                  <span>{new Date(a.created_at).toLocaleString("es-MX")}</span>
                  <span>· {a.responsable_email}</span>
                  {!a.fecha_completada && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => completar.mutateAsync({ id: a.id })}
                    >
                      <Check className="h-3 w-3 mr-1" /> Marcar completada
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
