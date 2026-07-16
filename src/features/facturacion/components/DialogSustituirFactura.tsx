/**
 * DialogSustituirFactura — Wizard de sustitución (motivo SAT 01).
 *
 * Flujo single-tab (v13.301.0+):
 *   1) Confirmar intención → duplicar factura como borrador (RPC).
 *   2) Navegar en la misma pestaña al detalle del borrador (persistencia en
 *      sessionStorage por `facturaId`).
 *   3) Regresar y confirmar cancelación motivo 01 con la sustituta timbrada.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Replace, ArrowRight, Ban, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { duplicarFacturaParaSustitucion } from "@/features/facturacion/services/facturapi";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { clearPersisted, writePersisted } from "./sustitucion/persistence";
import { useSustitucionState } from "./sustitucion/useSustitucionState";

interface Props {
  facturaId: string | null;
  numero?: string;
  uuidOriginal?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogSustituirFactura({ facturaId, numero, uuidOriginal, open, onOpenChange }: Props) {
  const [duplicando, setDuplicando] = useState(false);
  const navigate = useNavigate();
  const cancelar = useCancelarFactura();
  const s = useSustitucionState(facturaId, open);

  if (!facturaId) return null;

  const reset = () => { s.setStep("intro"); s.setNuevaId(null); };

  const handleDuplicar = async () => {
    setDuplicando(true);
    try {
      const id = await duplicarFacturaParaSustitucion(facturaId);
      writePersisted(facturaId, id);
      toast.success("Borrador sustituto creado");
      onOpenChange(false);
      navigate(`/facturacion/${id}?accion=timbrar`);
    } catch (err) {
      reportCaughtError(err, { feature: "facturacion", op: "duplicar_para_sustitucion" }, { facturaId });
      notifyError(toast, {
        title: "No se pudo duplicar",
        error: err as Error,
        method: "FEATURES_FACTURACION_DIALOG_SUSTITUIR_1",
      });
    } finally {
      setDuplicando(false);
    }
  };

  const handleIrABorrador = () => {
    if (!s.nuevaId) return;
    onOpenChange(false);
    navigate(`/facturacion/${s.nuevaId}?accion=timbrar`);
  };

  const handleReiniciar = () => { clearPersisted(facturaId); reset(); };

  const handleCancelarOriginal = () => {
    if (!s.nuevaId) return;
    cancelar.mutate(
      { facturaId, motivo: "01", sustituidaPorFacturaId: s.nuevaId },
      {
        // Éxito terminal (accepted) O pendiente (72 h): el wizard concluye desde
        // la perspectiva del usuario. El toast (info vs success) lo maneja el hook.
        onSuccess: () => { clearPersisted(facturaId); onOpenChange(false); reset(); },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.lg}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Replace className="h-5 w-5 text-accent" /> Sustituir CFDI {numero ?? ""}
          </DialogTitle>
          <DialogDescription>
            Sustitución SAT motivo 01. Se crea una nueva factura, la editas/timbras
            y al confirmar se cancela la original enlazándolas.
          </DialogDescription>
        </DialogHeader>

        {s.step === "intro" && <IntroBody numero={numero} uuidOriginal={uuidOriginal} />}

        {s.step === "confirmar" && (
          <ConfirmarBody
            numero={numero}
            isLoading={s.sustitutaQuery.isLoading}
            timbrada={s.sustitutaTimbrada}
            estadoLabel={s.sustitutaEstadoLabel}
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>

          {s.step === "intro" && (
            <Button onClick={handleDuplicar} disabled={duplicando || !uuidOriginal}>
              {duplicando ? "Creando…" : (<>Crear borrador y continuar <ArrowRight className="h-4 w-4 ml-1" /></>)}
            </Button>
          )}

          {s.step === "confirmar" && (
            <>
              <Button variant="outline" onClick={handleReiniciar}>
                <RotateCw className="h-4 w-4 mr-1" /> Reiniciar
              </Button>
              <Button variant="secondary" onClick={handleIrABorrador}>
                Volver al borrador
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelarOriginal}
                disabled={cancelar.isPending || !s.sustitutaTimbrada}
                title={!s.sustitutaTimbrada ? "La sustituta debe estar timbrada" : undefined}
              >
                <Ban className="h-4 w-4 mr-1" />
                {cancelar.isPending ? "Cancelando…" : "Cancelar original"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
