/**
 * Bloque S — Pestaña de cierre financiero del embarque.
 * Muestra checklist de validaciones, snapshot y bitácora de cierres/reaperturas.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CheckCircle2, XCircle, Lock, Unlock, History } from "lucide-react";
import {
  useCerrarEmbarque,
  useCierreLog,
  useReabrirEmbarque,
  useValidacionCierre,
} from "@/features/embarques/hooks/useCierreEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";

const ETIQUETAS_REGLA: Record<string, string> = {
  cxc_sin_pendientes: "Cuentas por cobrar al día",
  cxp_sin_pendientes: "Cuentas por pagar al día",
  documentos_completos: "Documentos requeridos completos",
  pnl_margen_minimo: "Utilidad mínima alcanzada",
  comision_calculada: "Comisión devengada calculada",
};

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

  const puedeCerrar = (isAdmin || canEditFinance) && estatus === "entregado";
  const puedeReabrir = isSuperAdmin || isAdmin;

  const [openCerrar, setOpenCerrar] = useState(false);
  const [openReabrir, setOpenReabrir] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [motivoReapertura, setMotivoReapertura] = useState("");

  const esCerrado = estatus === "cerrado";
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
      ) : estatus !== "entregado" ? (
        <Alert>
          <AlertTitle>Aún no se puede cerrar</AlertTitle>
          <AlertDescription>
            El embarque debe estar en estado <strong>Entregado</strong> para ejecutar el cierre.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de cierre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Validando…</p>}
          {!isLoading && checks.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          )}
          <ul className="space-y-2">
            {checks.map((c) => (
              <li
                key={c.regla}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{ETIQUETAS_REGLA[c.regla] ?? c.regla}</p>
                    {c.detalle && (
                      <p className="text-xs text-muted-foreground">
                        {JSON.stringify(c.detalle)}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={c.ok ? "secondary" : "destructive"}>
                  {c.ok ? "OK" : "Pendiente"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {!esCerrado && (
          <Button
            onClick={() => setOpenCerrar(true)}
            disabled={!puedeCerrar || !todoOk || cerrarMut.isPending}
          >
            <Lock className="mr-2 h-4 w-4" />
            Cerrar embarque
          </Button>
        )}
        {esCerrado && puedeReabrir && (
          <Button variant="outline" onClick={() => setOpenReabrir(true)}>
            <Unlock className="mr-2 h-4 w-4" />
            Reabrir embarque
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Historial de cierres
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          ) : (
            <ul className="space-y-2">
              {log.map((entry) => (
                <li key={entry.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant={entry.accion === "cerrar" ? "default" : "outline"}>
                      {entry.accion === "cerrar" ? "Cerrado" : "Reabierto"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("es-MX")}
                    </span>
                  </div>
                  {entry.motivo && (
                    <p className="mt-1 text-sm text-muted-foreground">{entry.motivo}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Diálogo cerrar */}
      <Dialog open={openCerrar} onOpenChange={setOpenCerrar}>
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
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CERRAR"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCerrar(false)}>Cancelar</Button>
            <Button
              disabled={confirmText !== "CERRAR" || cerrarMut.isPending}
              onClick={() =>
                cerrarMut.mutate(undefined, {
                  onSuccess: () => {
                    setOpenCerrar(false);
                    setConfirmText("");
                  },
                })
              }
            >
              Cerrar embarque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo reabrir */}
      <Dialog open={openReabrir} onOpenChange={setOpenReabrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir embarque cerrado</DialogTitle>
            <DialogDescription>
              Describe el motivo (mínimo 20 caracteres). Quedará registrado en bitácora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-reapertura">Motivo</Label>
            <Textarea
              id="motivo-reapertura"
              value={motivoReapertura}
              onChange={(e) => setMotivoReapertura(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {motivoReapertura.trim().length}/20 caracteres
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReabrir(false)}>Cancelar</Button>
            <Button
              disabled={motivoReapertura.trim().length < 20 || reabrirMut.isPending}
              onClick={() =>
                reabrirMut.mutate(motivoReapertura, {
                  onSuccess: () => {
                    setOpenReabrir(false);
                    setMotivoReapertura("");
                  },
                })
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
