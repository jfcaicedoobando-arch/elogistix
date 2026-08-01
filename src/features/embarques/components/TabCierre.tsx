/**
 * Bloque S — Pestaña de cierre financiero del embarque.
 * Orquesta validación + acciones de cierre/reapertura.
 *
 * v13.56.6 — paso 15: checklist e historial extraídos a subcomponentes
 * presentacionales en `components/cierre/`.
 */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Lock, Unlock } from "lucide-react";
import {
  useCerrarEmbarque,
  useCierreLog,
  useReabrirEmbarque,
  useValidacionCierre,
} from "@/features/embarques/hooks/useCierreEmbarque";
import { useCierreDialog } from "@/features/embarques/hooks/useCierreDialog";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useSinComisionEmbarque } from "@/features/embarques/hooks/useSinComisionEmbarque";
import { CierreChecklistCard } from "./cierre/CierreChecklistCard";
import { CierreHistorialCard } from "./cierre/CierreHistorialCard";
import { CerrarEmbarqueDialog, ReabrirEmbarqueDialog } from "./cierre/CierreDialogs";

// v13.89.2 — Etiquetas y mapeos ahora viven en `utils/cierreCheckMeta.ts`.

// EIR sólo aplica al flujo marítimo (último paso operativo del contenedor).
// Aéreo/terrestre cierran desde Entregado.
// v13.380.1 — "Por liquidar" (cierre operativo listo, falta cobrar/pagar) también
// habilita el cierre: la BD lo acepta en `cerrar_embarque`.
const ESTADOS_LISTOS_PARA_CIERRE = new Set(["entregado", "eir", "por liquidar"]);

interface Props {
  embarqueId: string;
  estatus: string;
  modo?: string;
  /** v13.385.0 — Expediente, usado por los enlaces del checklist. */
  expediente?: string;
}

// eslint-disable-next-line complexity
export function TabCierre({ embarqueId, estatus, modo, expediente }: Props) {
  const { data: validacion, isLoading } = useValidacionCierre(embarqueId);
  const { data: log = [] } = useCierreLog(embarqueId);
  const cerrarMut = useCerrarEmbarque(embarqueId);
  const reabrirMut = useReabrirEmbarque(embarqueId);
  const { canCerrarEmbarque, isAdmin, isSuperAdmin } = usePermissions();
  const { data: comisionEstado } = useSinComisionEmbarque(embarqueId);

  const estatusNormalizado = (estatus ?? "").toLowerCase();
  const listoParaCierre = ESTADOS_LISTOS_PARA_CIERRE.has(estatusNormalizado);
  const puedeCerrar = canCerrarEmbarque && listoParaCierre;
  const puedeReabrir = isSuperAdmin || isAdmin;

  const dlg = useCierreDialog();

  const esCerrado = estatusNormalizado === "cerrado";
  const checks = validacion?.checks ?? [];
  const todoOk = validacion?.puede_cerrar === true;

  return (
    <div className="space-y-6">
      {esCerrado ? (
        <Alert variant="default" className="border-primary/40">
          <Lock className="h-4 w-4" />
          <AlertTitle>Embarque cerrado</AlertTitle>
          <AlertDescription>
            Las ediciones de costos, ventas, documentos, facturas y pagos están bloqueadas.
            La comisión devengada se marcó como definitiva.
          </AlertDescription>
        </Alert>
      ) : !listoParaCierre ? (
        <Alert>
          <AlertTitle>Aún no se puede cerrar</AlertTitle>
          <AlertDescription>
            {modo?.toLowerCase() === "marítimo" ? (
              <>El embarque <strong>marítimo</strong> debe llegar a <strong>EIR</strong> (Equipo Intercambio Reparado) o <strong>Por liquidar</strong> para ejecutar el cierre.</>
            ) : (
              <>El embarque debe estar en <strong>Entregado</strong> o <strong>Por liquidar</strong> para ejecutar el cierre.</>
            )}
          </AlertDescription>

        </Alert>
      ) : null}

      <CierreChecklistCard isLoading={isLoading} checks={checks} embarqueId={embarqueId} expediente={expediente} informativo={esCerrado} sinComision={comisionEstado?.efectivo ?? false} />

      <div className="flex flex-wrap items-center gap-2">
        {!esCerrado && canCerrarEmbarque && (() => {
          const disabled = !puedeCerrar || !todoOk || cerrarMut.isPending;
          const pendientes = checks.filter((c) => !c.ok).length;
          const motivo = !listoParaCierre
            ? (modo?.toLowerCase() === "marítimo"
                ? "El embarque debe estar en EIR o Por liquidar para cerrar."
                : "El embarque debe estar en Entregado o Por liquidar para cerrar.")

            : pendientes > 0
              ? `Faltan ${pendientes} pendiente${pendientes === 1 ? "" : "s"} del checklist.`
              : null;
          const btn = (
            <Button
              onClick={() => dlg.setOpenCerrar(true)}
              disabled={disabled}
            >
              <Lock className="mr-2 h-4 w-4" />
              Cerrar embarque
            </Button>
          );
          if (!disabled || !motivo) return btn;
          return (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">{motivo}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}
        {!esCerrado && !canCerrarEmbarque && (
          <p className="text-xs text-muted-foreground">
            El cierre del embarque es responsabilidad del <strong>coordinador logístico</strong>.
          </p>
        )}
        {esCerrado && puedeReabrir && (
          <Button variant="outline" onClick={() => dlg.setOpenReabrir(true)}>
            <Unlock className="mr-2 h-4 w-4" />
            Reabrir embarque
          </Button>
        )}
      </div>

      <CierreHistorialCard log={log} />

      <CerrarEmbarqueDialog
        open={dlg.openCerrar}
        onOpenChange={dlg.setOpenCerrar}
        confirmText={dlg.confirmText}
        onConfirmTextChange={dlg.setConfirmText}
        puedeConfirmar={dlg.puedeConfirmarCerrar}
        isPending={cerrarMut.isPending}
        onConfirm={() => cerrarMut.mutate(undefined, { onSuccess: dlg.resetCerrar })}
      />

      <ReabrirEmbarqueDialog
        open={dlg.openReabrir}
        onOpenChange={dlg.setOpenReabrir}
        motivo={dlg.motivoReapertura}
        onMotivoChange={dlg.setMotivoReapertura}
        puedeConfirmar={dlg.puedeConfirmarReabrir}
        isPending={reabrirMut.isPending}
        onConfirm={() => reabrirMut.mutate(dlg.motivoReapertura, { onSuccess: dlg.resetReabrir })}
      />
    </div>
  );
}
