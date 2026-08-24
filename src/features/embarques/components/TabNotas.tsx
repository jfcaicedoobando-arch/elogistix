import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Send } from "lucide-react";

import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared";
import { useCreateNotaEmbarque, useActividadEmbarque } from "@/features/embarques/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import type { NotaEmbarqueRow } from "@/features/embarques/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { ActividadFeedTimeline } from "@/features/embarques/components/ActividadFeedTimeline";
import { ActividadFiltros } from "@/features/embarques/components/ActividadFiltros";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { MessageSquare } from "lucide-react";

interface Props {
  notas: NotaEmbarqueRow[];
  embarqueId?: string;
  expediente?: string | null;
  creadoPor?: string | null;
  creadoEn?: string | null;
}

export function TabNotas({ embarqueId, expediente }: Props) {
  const [texto, setTexto] = useState("");
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const crearNota = useCreateNotaEmbarque();
  const registrarActividad = useRegistrarActividad();

  const { grupos, conteos, categoria, setCategoria, items, isLoading, isError, refetch } =
    useActividadEmbarque(embarqueId);

  const handleSubmit = async () => {
    if (!texto.trim() || !embarqueId) return;
    try {
      await crearNota.mutateAsync({
        embarqueId,
        contenido: texto.trim(),
        usuario: user?.email ?? "",
      });
      registrarActividad.mutate({
        accion: "agregar_nota",
        modulo: "embarques",
        entidad_id: embarqueId,
        entidad_nombre: expediente ?? "",
        detalles: { nota: texto.trim() },
      });
      setTexto("");
      refetch();
      notifySuccess(undefined, { title: "Nota agregada" });
    } catch (err: unknown) {
      notifyError(undefined, {
        title: "Error al agregar nota",
        description: getErrorMessage(err),
        error: err,
        method: "HANDLE_SUBMIT",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle>Actividad y Notas</CardTitle>
        <Button variant="ghost" size="sm" onClick={refetch} aria-label="Actualizar actividad">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && embarqueId && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Escribe una nota…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="min-h-16"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              onClick={handleSubmit}
              aria-label="Enviar nota"
              disabled={!texto.trim() || crearNota.isPending}
              loading={crearNota.isPending}
            >
              {!crearNota.isPending && <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <ActividadFiltros conteos={conteos} categoria={categoria} onChange={setCategoria} />

        {isLoading ? (
          <EmptyStateInline loading message="Cargando actividad…" className="py-6" />
        ) : isError ? (
          <ErrorStateInline
            title="No se pudo cargar la actividad"
            message="Ocurrió un error al obtener las notas y eventos del embarque."
            onRetry={() => void refetch()}
            className="py-6"
          />
        ) : items.length === 0 ? (
          <EmptyStateInline icon={MessageSquare} message="Sin actividad registrada" className="py-8" />
        ) : (
          <ActividadFeedTimeline grupos={grupos} />
        )}
      </CardContent>
    </Card>
  );
}
