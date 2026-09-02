/**
 * v13.214.0 — Rediseño del formulario de tracking.
 *
 * Solo se permiten 2 acciones desde el botón "Registrar Evento":
 *   1. **Actualizar ETA** — el operador captura la nueva fecha publicada por
 *      la naviera. Se actualiza `embarques.eta` (el ETA vigente que consume
 *      toda la app) y se registra un evento `Cambio de ETA` en la bitácora.
 *      El `eta_original` queda congelado por trigger de BD.
 *   2. **Marcar Llegada real** — única vía para avanzar el embarque de
 *      "En Tránsito" a "Llegada". Se actualiza `fecha_llegada_real` y
 *      `estado='Llegada'`, y se registra un evento `Arribo a Puerto`.

 *
 * Los otros tipos de evento históricos (Zarpe, Transbordo, Descarga, etc.)
 * se retiran del UI. Los eventos ya persistidos siguen visibles en el timeline.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Anchor } from "lucide-react";
import { useCreateEventoEmbarque } from "@/features/embarques/hooks";
import { useActualizarFechaLlegadaReal } from "@/features/embarques/hooks/mutations/useActualizarFechaLlegadaReal";
import { useActualizarEta } from "@/features/embarques/hooks/mutations/useActualizarEta";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { formatDate } from "@/lib/formatters";
import { ActualizarEtaForm } from "./ActualizarEtaForm";
import { MarcarLlegadaForm } from "./MarcarLlegadaForm";
import { contarDocumentosPendientes } from "@/features/embarques/services/documentosPendientes";

type Modo = "menu" | "eta" | "llegada";

interface Props {
  embarqueId: string;
  estadoActual?: string | null;
  etaActual?: string | null;
  fechaLlegadaRealActual?: string | null;
  destinoDefault?: string | null;
  onClose: () => void;
}

export function TrackingNuevoEventoForm({
  embarqueId,
  etaActual,
  fechaLlegadaRealActual,
  destinoDefault,
  onClose,
}: Props) {
  const [modo, setModo] = useState<Modo>("menu");
  const crearEvento = useCreateEventoEmbarque({ silent: true });
  const actualizarEta = useActualizarEta({ silent: true });
  const actualizarFechaLlegada = useActualizarFechaLlegadaReal({ silent: true });
  const { user } = useAuth();

  if (modo === "menu") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>¿Qué quieres registrar?</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setModo("eta")}
            className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CalendarClock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-body">Actualizar ETA</div>
              <div className="text-body-sm text-muted-foreground mt-1">
                Nueva fecha publicada por la naviera. Se propaga a toda la app.
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setModo("llegada")}
            className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Anchor className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-body">Marcar Llegada real</div>
              <div className="text-body-sm text-muted-foreground mt-1">
                Fecha en que llegó el contenedor. Avanza el embarque a "Llegada".
              </div>
            </div>
          </button>
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (modo === "eta") {
    return (
      <ActualizarEtaForm
        etaActual={etaActual ?? null}
        isPending={actualizarEta.isPending || crearEvento.isPending}
        onCancel={() => setModo("menu")}
        onSubmit={async ({ fecha, fuente }) => {
          try {
            const etaAnteriorFmt = etaActual ? formatDate(etaActual, "dd/MM/yyyy") : "—";
            const etaNuevaFmt = formatDate(fecha, "dd/MM/yyyy");
            await actualizarEta.mutateAsync({ embarqueId, nuevaEta: fecha });
            await crearEvento.mutateAsync({
              embarqueId,
              tipo: "Cambio de ETA",
              descripcion: `ETA actualizada de ${etaAnteriorFmt} a ${etaNuevaFmt}`,
              ubicacion: fuente?.trim() ?? "",
              fecha: new Date().toISOString(),
              usuario: user?.email ?? "",
            });
            notifySuccess(undefined, { title: "ETA actualizada" });
            onClose();
          } catch (err: unknown) {
            notifyError(undefined, {
              title: "Error al actualizar ETA",
              description: getErrorMessage(err),
              error: err,
              method: "TRACKING_ACTUALIZAR_ETA",
            });
          }
        }}
      />
    );
  }

  // modo === "llegada"
  return (
    <MarcarLlegadaForm
      fechaLlegadaActual={fechaLlegadaRealActual ?? null}
      destinoDefault={destinoDefault ?? ""}
      isPending={actualizarFechaLlegada.isPending || crearEvento.isPending}
      onCancel={() => setModo("menu")}
      onSubmit={async ({ fecha, ubicacion }) => {
        try {
          const pendientes = await contarDocumentosPendientes(embarqueId);
          if (pendientes > 0) {
            notifyError(undefined, {
              title: "Documentos incompletos",
              description: `Hay ${pendientes} documento(s) pendiente(s). Súbelos antes de marcar la llegada real.`,
            });
            return;
          }
          // `fecha` ya es ISO `YYYY-MM-DD` (columna `date` en BD).
          // No re-serializar a UTC: rompía `isoToDisplay` en re-lecturas
          // y desfasaba el día en hora local de México.
          await actualizarFechaLlegada.mutateAsync({ embarqueId, fechaIso: fecha });
          await crearEvento.mutateAsync({
            embarqueId,
            tipo: "Arribo a Puerto",
            descripcion: `Llegada real registrada: ${formatDate(fecha, "dd/MM/yyyy")}`,
            ubicacion: ubicacion?.trim() ?? "",
            fecha: new Date().toISOString(),
            usuario: user?.email ?? "",
          });
          notifySuccess(undefined, { title: "Llegada real registrada" });
          onClose();
        } catch (err: unknown) {
          notifyError(undefined, {
            title: "Error al registrar llegada",
            description: getErrorMessage(err),
            error: err,
            method: "TRACKING_MARCAR_LLEGADA",
          });
        }
      }}
    />
  );
}
