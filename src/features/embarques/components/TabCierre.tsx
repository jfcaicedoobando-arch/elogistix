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

const ETIQUETAS_REGLA: Record<string, string> = {
  cxc_sin_pendientes: "Cuentas por cobrar al día",
  cxc_cobrada: "Cuentas por cobrar al día",
  cxp_sin_pendientes: "Cuentas por pagar al día",
  cxp_pagada: "Cuentas por pagar al día",
  documentos_completos: "Documentos requeridos completos",
  docs_completos: "Documentos requeridos completos",
  pnl_margen_minimo: "Utilidad mínima alcanzada",
  comision_calculada: "Comisión devengada calculada",
  contenedores_datos_completos: "Datos de contenedores capturados (peso y volumen)",
  venta_conceptos_facturados: "Todos los conceptos de venta facturados",
  costo_conceptos_con_factura: "Todos los costos tienen factura de proveedor recibida",
  costos_liquidados: "Todos los costos están liquidados (pagados al proveedor)",
};

// EIR sólo aplica al flujo marítimo (último paso operativo del contenedor).
// Aéreo/terrestre cierran desde Entregado.
const ESTADOS_LISTOS_PARA_CIERRE = new Set(["entregado", "eir"]);

interface Props {
  embarqueId: string;
  estatus: string;
}

export function TabCierre({ embarqueId, estatus }: Props) {
  const { data: validacion, isLoading } = useValidacionCierre(embarqueId);
  const { data: log = [] } = useCierreLog(embarqueId);
  const cerrarMut = useCerrarEmbarque(embarqueId);
  const reabrirMut = useReabrirEmbarque(embarqueId);
  const { canEditFinance, isAdmin, isSuperAdmin } = usePermissions();

  const estatusNormalizado = (estatus ?? "").toLowerCase();
  const listoParaCierre = ESTADOS_LISTOS_PARA_CIERRE.has(estatusNormalizado);
  const puedeCerrar = (isAdmin || canEditFinance) && listoParaCierre;
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
            El embarque debe estar en estado <strong>Entregado</strong> o <strong>EIR</strong> para ejecutar el cierre.
          </AlertDescription>
        </Alert>
      ) : null}

      <CierreChecklistCard isLoading={isLoading} checks={checks} etiquetas={ETIQUETAS_REGLA} />

      <div className="flex flex-wrap gap-2">
        {!esCerrado && (
          <Button
            onClick={() => dlg.setOpenCerrar(true)}
            disabled={!puedeCerrar || !todoOk || cerrarMut.isPending}
          >
            <Lock className="mr-2 h-4 w-4" />
            Cerrar embarque
          </Button>
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
        <DialogContent>
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
        <DialogContent>
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
