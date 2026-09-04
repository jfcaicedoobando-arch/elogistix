/**
 * ActividadTimeline — timeline + alta rápida de actividades polimórficas.
 */
import { useState } from "react";
import { Activity, Check, History, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { notifyError } from "@/lib/ui/appFeedback";
import { formatFechaHora } from "@/lib/formatters";
import {
  useActividades, useCrearActividad, useCompletarActividad,
  ACTIVIDAD_TIPOS, type CrmActividadTipo, type CrmEntidadTipo,
} from "@/features/crm/hooks";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { usePermissions } from "@/hooks/shared";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
interface Props {
  entidadTipo: CrmEntidadTipo;
  entidadId: string;
}

export default function ActividadTimeline({ entidadTipo, entidadId }: Props) {
  // Espejo de las policies de `crm_actividades`: sin capacidad no se muestra
  // el alta ni el botón de completar (antes terminaban en RLS 42501).
  const { canCrearActividad, canGestionarActividad } = usePermissions();
  const { data, isError, refetch } = useActividades({ entidadTipo, entidadId, estado: "todas", pageSize: 100 });
  const crear = useCrearActividad();
  const completar = useCompletarActividad();
  const [tipo, setTipo] = useState<CrmActividadTipo>("nota");
  const [asunto, setAsunto] = useState("");
  const [desc, setDesc] = useState("");

  const items = data?.data ?? [];

  const handleCrear = async () => {
    if (!asunto.trim()) return notifyError(undefined, { title: "Asunto requerido", method: "HANDLE_CREAR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    // v13.823.49 — el feedback (éxito y error) lo emite `useCrearActividad`;
    // aquí sólo se limpia el formulario. Antes salían dos toasts por acción.
    try {
      await crear.mutateAsync({ tipo, asunto, descripcion: desc, entidad_tipo: entidadTipo, entidad_id: entidadId });
      setAsunto(""); setDesc("");
    } catch {
      /* ya notificado por el hook */
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Actividades</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {canCrearActividad && (
        <div className="grid grid-cols-1 md:grid-cols-[140px,1fr,auto] gap-2">
          <Select value={tipo} onValueChange={(v) => setTipo(v as CrmActividadTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVIDAD_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label="Asunto de la actividad" placeholder="Asunto…" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          <Button aria-label="Agregar actividad" onClick={handleCrear} disabled={crear.isPending} loading={crear.isPending}>
            {!crear.isPending && <Plus className="h-4 w-4" />}
            <span className="sr-only">Agregar actividad</span>
          </Button>
          <Textarea
            className="md:col-span-3"
            rows={2}
            placeholder="Descripción (opcional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        )}

        {isError ? (
          <ErrorStateInline message="No se pudieron cargar las actividades." onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyStateInline icon={History} message="Sin actividades registradas" />
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className="border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center gap-2 text-body">
                  <Badge variant="outline" className="text-label">{a.tipo}</Badge>
                  <span className="font-medium">{a.asunto}</span>
                  {a.fecha_completada && <Badge variant="secondary" className="text-label">Completada</Badge>}
                </div>
                {a.descripcion && <div className="text-body-sm text-muted-foreground mt-1">{a.descripcion}</div>}
                <div className="text-label text-muted-foreground mt-1 flex items-center gap-2">
                  <span>{formatFechaHora(a.created_at)}</span>
                  <span>· {a.responsable_email}</span>
                  {!a.fecha_completada && canGestionarActividad(a.responsable_id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-label"
                      // UX-13: sin disabled, doble clic disparaba la mutación dos veces.
                      disabled={completar.isPending}
                      // El feedback lo emite `useCompletarActividad`.
                      onClick={() => { void completar.mutateAsync({ id: a.id }).catch(() => {}); }}
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
