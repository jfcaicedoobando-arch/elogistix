/**
 * Bloque S — Pestaña de cierre financiero del embarque.
 * Orquesta validación + acciones de cierre/reapertura.
 *
 * v13.56.6 — paso 15: checklist e historial extraídos a subcomponentes
 * presentacionales en `components/cierre/`.
 */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Lock, Unlock } from "lucide-react";
import {
  useCerrarEmbarque,
  useCierreLog,
  useReabrirEmbarque,
  useValidacionCierre,
} from "@/features/embarques/hooks/useCierreEmbarque";
import { useCierreDialog, CIERRE_MOTIVO_MIN } from "@/features/embarques/hooks/useCierreDialog";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { CierreChecklistCard } from "./cierre/CierreChecklistCard";
import { CierreHistorialCard } from "./cierre/CierreHistorialCard";

// v13.89.2 — Etiquetas y mapeos ahora viven en `utils/cierreCheckMeta.ts`.

// EIR sólo aplica al flujo marítimo (último paso operativo del contenedor).
// Aéreo/terrestre cierran desde Entregado.
const ESTADOS_LISTOS_PARA_CIERRE = new Set(["entregado", "eir"]);

interface Props {
  embarqueId: string;
  estatus: string;
  modo?: string;
}

export function TabCierre({ embarqueId, estatus, modo }: Props) {
  const { data: validacion, isLoading } = useValidacionCierre(embarqueId);
  const { data: log = [] } = useCierreLog(embarqueId);
  const cerrarMut = useCerrarEmbarque(embarqueId);
  const reabrirMut = useReabrirEmbarque(embarqueId);
  const { canCerrarEmbarque, isAdmin, isSuperAdmin } = usePermissions();

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
              <>El embarque <strong>marítimo</strong> debe estar en estado <strong>EIR</strong> (Equipo Intercambio Reparado) para ejecutar el cierre.</>
            ) : (
              <>El embarque debe estar en estado <strong>Entregado</strong> para ejecutar el cierre.</>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <CierreChecklistCard isLoading={isLoading} checks={checks} embarqueId={embarqueId} informativo={esCerrado} />

      <div className="flex flex-wrap items-center gap-2">
        {!esCerrado && canCerrarEmbarque && (() => {
          const disabled = !puedeCerrar || !todoOk || cerrarMut.isPending;
          const pendientes = checks.filter((c) => !c.ok).length;
          const motivo = !listoParaCierre
            ? (modo?.toLowerCase() === "marítimo"
                ? "El embarque debe estar en EIR para cerrar."
                : "El embarque debe estar en Entregado para cerrar.")
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

      {/* Diálogo cerrar */}
      <Dialog open={dlg.openCerrar} onOpenChange={dlg.setOpenCerrar}>
        <DialogContent className={dialogSize.md}>
          <DialogHeader>
            <DialogTitle>Confirmar cierre del embarque</DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong> sin intervención de un super admin.
              Escribe <strong>CERRAR</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-cerrar">Confirmación</Label>
            <Input
              id="confirm-cerrar"
              value={dlg.confirmText}
              onChange={(e) => dlg.setConfirmText(e.target.value)}
              placeholder="CERRAR"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => dlg.setOpenCerrar(false)}>Cancelar</Button>
            <Button
              disabled={!dlg.puedeConfirmarCerrar || cerrarMut.isPending}
              onClick={() =>
                cerrarMut.mutate(undefined, { onSuccess: dlg.resetCerrar })
              }
            >
              Cerrar embarque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo reabrir */}
      <Dialog open={dlg.openReabrir} onOpenChange={dlg.setOpenReabrir}>
        <DialogContent className={dialogSize.md}>
          <DialogHeader>
            <DialogTitle>Reabrir embarque cerrado</DialogTitle>
            <DialogDescription>
              Describe el motivo (mínimo {CIERRE_MOTIVO_MIN} caracteres). Quedará registrado en bitácora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-reapertura">Motivo</Label>
            <Textarea
              id="motivo-reapertura"
              value={dlg.motivoReapertura}
              onChange={(e) => dlg.setMotivoReapertura(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {dlg.motivoReapertura.trim().length}/{CIERRE_MOTIVO_MIN} caracteres
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => dlg.setOpenReabrir(false)}>Cancelar</Button>
            <Button
              disabled={!dlg.puedeConfirmarReabrir || reabrirMut.isPending}
              onClick={() =>
                reabrirMut.mutate(dlg.motivoReapertura, { onSuccess: dlg.resetReabrir })
              }
            >
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
