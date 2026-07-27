import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageSquare, Activity, History } from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared";
import { useCreateNotaEmbarque, useEventosEmbarque, useActividadEmbarque } from "@/features/embarques/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import type { NotaEmbarqueRow } from "@/features/embarques/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { formatDate, nombreDesdeEmail } from "@/lib/formatters";

interface Props {
  notas: NotaEmbarqueRow[];
  embarqueId?: string;
  expediente?: string | null;
  creadoPor?: string | null;
  creadoEn?: string | null;
}

const TIPO_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "warning"> = {
  nota: "secondary",
  evento: "default",
  bitacora: "outline",
};

const TIPO_ICON = {
  nota: MessageSquare,
  evento: Activity,
  bitacora: History,
} as const;

export function TabNotas({ notas, embarqueId, expediente, creadoPor, creadoEn }: Props) {
  const [texto, setTexto] = useState("");
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const crearNota = useCreateNotaEmbarque();
  const registrarActividad = useRegistrarActividad();
  const { data: eventos = [] } = useEventosEmbarque(embarqueId);

  const { items, isLoading } = useActividadEmbarque({
    embarqueId,
    expediente: expediente ?? null,
    notas,
    eventos,
    creadoPor,
    creadoEn,
  });

  const handleSubmit = async () => {
    if (!texto.trim() || !embarqueId) return;
    try {
      await crearNota.mutateAsync({
        embarqueId,
        contenido: texto.trim(),
        usuario: user?.email ?? '',
      });
      registrarActividad.mutate({
        accion: 'agregar_nota',
        modulo: 'embarques',
        entidad_id: embarqueId,
        entidad_nombre: expediente ?? '',
        detalles: { nota: texto.trim() },
      });
      setTexto("");
      notifySuccess(undefined, { title: "Nota agregada" });
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error al agregar nota", description: getErrorMessage(err), error: err, method: "HANDLE_SUBMIT" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Actividad y Notas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && embarqueId && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Escribe una nota..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="min-h-[60px]"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              onClick={handleSubmit}
              aria-label="Enviar nota"
              disabled={!texto.trim() || crearNota.isPending}
            >
              {crearNota.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando actividad...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin actividad registrada</p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const Icon = TIPO_ICON[it.tipo];
              const usuario = it.usuario && it.usuario.trim() ? nombreDesdeEmail(it.usuario) : "Sistema";
              return (
                <div key={it.id} className="flex gap-3 text-sm border-l-2 border-border pl-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={TIPO_BADGE_VARIANT[it.tipo] ?? "secondary"} className="text-2xs uppercase">
                        {it.accion}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <span title={it.usuario || undefined} className="font-medium text-foreground">{usuario}</span>
                        {" · "}
                        {formatDate(it.fecha, "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="mt-1 break-words whitespace-pre-wrap">{it.titulo}</p>
                    {it.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5">{it.descripcion}</p>
                    )}
                    {it.detalles && Object.keys(it.detalles).length > 0 && (
                      <DetallesBitacora detalles={it.detalles} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetallesBitacora({ detalles }: { detalles: Record<string, unknown> }) {
  const cambios = (detalles as { cambios?: { embarque?: Array<{ campo: string; antes: unknown; despues: unknown }> } }).cambios;
  if (cambios?.embarque && cambios.embarque.length > 0) {
    return (
      <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
        {cambios.embarque.slice(0, 6).map((c, i) => (
          <li key={i}>
            <span className="font-medium">{c.campo}:</span>{" "}
            <span className="line-through opacity-70">{String(c.antes ?? "—")}</span>
            {" → "}
            <span className="text-foreground">{String(c.despues ?? "—")}</span>
          </li>
        ))}
        {cambios.embarque.length > 6 && (
          <li className="italic">+{cambios.embarque.length - 6} cambios más</li>
        )}
      </ul>
    );
  }
  const entries = Object.entries(detalles).filter(([, v]) => v !== null && v !== "" && v !== undefined);
  if (entries.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {entries.slice(0, 4).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}
    </p>
  );
}
