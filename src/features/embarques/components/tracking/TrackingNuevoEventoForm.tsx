/**
 * v13.214.0 — Rediseño del formulario de tracking.
 *
 * Solo se permiten 2 acciones desde el botón "Registrar Evento":
 *   1. **Actualizar ETA** — el operador captura la nueva fecha publicada por
 *      la naviera. Se actualiza `embarques.eta` (el ETA vigente que consume
 *      toda la app) y se registra un evento `Cambio de ETA` en la bitácora.
 *      El `eta_original` queda congelado por trigger de BD.
 *   2. **Marcar Llegada real** — única vía para avanzar el embarque de
 *      "En Tránsito" a "Arribo". Se actualiza `fecha_llegada_real` y
 *      `estado='Arribo'`, y se registra un evento `Arribo a Puerto`.
 *
 * Los otros tipos de evento históricos (Zarpe, Transbordo, Descarga, etc.)
 * se retiran del UI. Los eventos ya persistidos siguen visibles en el timeline.
 */
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { CalendarClock, Anchor } from "lucide-react";
import { useCreateEventoEmbarque } from "@/features/embarques/hooks";
import { useActualizarFechaLlegadaReal } from "@/features/embarques/hooks/mutations/useActualizarFechaLlegadaReal";
import { useActualizarEta } from "@/features/embarques/hooks/mutations/useActualizarEta";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { formatDate } from "@/lib/formatters";

type Modo = "menu" | "eta" | "llegada";

const etaSchema = z.object({
  fecha: z.string().min(1, "Fecha requerida"),
  fuente: z.string().max(120, "Máximo 120 caracteres").optional().default(""),
});
type EtaForm = z.infer<typeof etaSchema>;

const llegadaSchema = z.object({
  fecha: z.string().min(1, "Fecha requerida"),
  ubicacion: z.string().max(120, "Máximo 120 caracteres").optional().default(""),
});
type LlegadaForm = z.infer<typeof llegadaSchema>;

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
  const crearEvento = useCreateEventoEmbarque();
  const actualizarEta = useActualizarEta();
  const actualizarFechaLlegada = useActualizarFechaLlegadaReal();
  const { user } = useAuth();
  const { toast } = useToast();

  if (modo === "menu") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">¿Qué quieres registrar?</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setModo("eta")}
            className="flex items-start gap-3 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
          >
            <CalendarClock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">Actualizar ETA</div>
              <div className="text-xs text-muted-foreground mt-1">
                Nueva fecha publicada por la naviera. Se propaga a toda la app.
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setModo("llegada")}
            className="flex items-start gap-3 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
          >
            <Anchor className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">Marcar Llegada real</div>
              <div className="text-xs text-muted-foreground mt-1">
                Fecha en que llegó el contenedor. Avanza el embarque a "Arribo".
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
            notifySuccess(toast, { title: "ETA actualizada" });
            onClose();
          } catch (err: unknown) {
            notifyError(toast, {
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
          const fechaIso = new Date(`${fecha}T00:00:00`).toISOString();
          await actualizarFechaLlegada.mutateAsync({ embarqueId, fechaIso });
          await crearEvento.mutateAsync({
            embarqueId,
            tipo: "Arribo a Puerto",
            descripcion: `Llegada real registrada: ${formatDate(fecha, "dd/MM/yyyy")}`,
            ubicacion: ubicacion?.trim() ?? "",
            fecha: fechaIso,
            usuario: user?.email ?? "",
          });
          notifySuccess(toast, { title: "Llegada real registrada" });
          onClose();
        } catch (err: unknown) {
          notifyError(toast, {
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

// ─── Subformularios ──────────────────────────────────────────────────────────

function ActualizarEtaForm({
  etaActual,
  isPending,
  onSubmit,
  onCancel,
}: {
  etaActual: string | null;
  isPending: boolean;
  onSubmit: (v: EtaForm) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { control, handleSubmit, formState: { errors, isValid } } = useForm<EtaForm>({
    resolver: zodResolver(etaSchema),
    defaultValues: { fecha: etaActual ?? "", fuente: "" },
    mode: "onChange",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Actualizar ETA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Nuevo ETA *</label>
            <Controller
              control={control}
              name="fecha"
              render={({ field }) => (
                <DatePickerMx value={field.value ?? ""} onChange={field.onChange} className="w-full" />
              )}
            />
            {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
            <p className="text-xs text-muted-foreground">
              ETA anterior: {etaActual ? formatDate(etaActual, "dd/MM/yyyy") : "—"}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fuente / Motivo</label>
            <Controller
              control={control}
              name="fuente"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Ej. Portal Maersk, aviso del agente..."
                  maxLength={120}
                />
              )}
            />
            {errors.fuente && <p className="text-xs text-destructive">{errors.fuente.message}</p>}
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
              Volver
            </Button>
            <Button type="submit" size="sm" disabled={!isValid || isPending}>
              {isPending ? "Guardando..." : "Actualizar ETA"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MarcarLlegadaForm({
  fechaLlegadaActual,
  destinoDefault,
  isPending,
  onSubmit,
  onCancel,
}: {
  fechaLlegadaActual: string | null;
  destinoDefault: string;
  isPending: boolean;
  onSubmit: (v: LlegadaForm) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { control, handleSubmit, formState: { errors, isValid } } = useForm<LlegadaForm>({
    resolver: zodResolver(llegadaSchema),
    defaultValues: {
      fecha: fechaLlegadaActual ?? new Date().toISOString().slice(0, 10),
      ubicacion: destinoDefault,
    },
    mode: "onChange",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Anchor className="h-4 w-4 text-primary" /> Marcar Llegada real
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha de llegada real *</label>
            <Controller
              control={control}
              name="fecha"
              render={({ field }) => (
                <DatePickerMx value={field.value ?? ""} onChange={field.onChange} className="w-full" />
              )}
            />
            {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
            <p className="text-xs text-muted-foreground">
              Al guardar, el embarque avanza a "Arribo".
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ubicación / Puerto</label>
            <Controller
              control={control}
              name="ubicacion"
              render={({ field }) => (
                <Input {...field} placeholder="Puerto o punto de arribo" maxLength={120} />
              )}
            />
            {errors.ubicacion && <p className="text-xs text-destructive">{errors.ubicacion.message}</p>}
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
              Volver
            </Button>
            <Button type="submit" size="sm" disabled={!isValid || isPending}>
              {isPending ? "Guardando..." : "Registrar llegada"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
