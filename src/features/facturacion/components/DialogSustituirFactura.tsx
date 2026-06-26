/**
 * DialogSustituirFactura — Wizard de sustitución (motivo SAT 01).
 *
 * Flujo:
 *   1) Confirmar intención y duplicar la factura como borrador (RPC
 *      `duplicar_factura_para_sustitucion`).
 *   2) El usuario edita y timbra la factura sustituta (link al detalle).
 *   3) Confirmar cancelación del CFDI original referenciando a la sustituta;
 *      el backend marca la original como `Sustituida`.
 */
import { useState } from "react";
import { Replace, ExternalLink, ArrowRight, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { duplicarFacturaParaSustitucion } from "@/features/facturacion/services/facturapi";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { notifyError } from "@/components/shared/utils/appFeedback";

interface Props {
  facturaId: string | null;
  numero?: string;
  uuidOriginal?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Step = "intro" | "borrador" | "confirmar";

export function DialogSustituirFactura({ facturaId, numero, uuidOriginal, open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [nuevaId, setNuevaId] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState(false);
  const cancelar = useCancelarFactura();

  if (!facturaId) return null;

  const reset = () => { setStep("intro"); setNuevaId(null); };

  const handleDuplicar = async () => {
    setDuplicando(true);
    try {
      const id = await duplicarFacturaParaSustitucion(facturaId);
      setNuevaId(id);
      setStep("borrador");
      toast.success("Borrador sustituto creado");
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo duplicar",
        error: err as Error,
        method: "FEATURES_FACTURACION_DIALOG_SUSTITUIR_1",
      });
    } finally {
      setDuplicando(false);
    }
  };

  const handleCancelarOriginal = () => {
    if (!nuevaId) return;
    cancelar.mutate(
      { facturaId, motivo: "01", sustituidaPorFacturaId: nuevaId },
      {
        onSuccess: () => { onOpenChange(false); reset(); },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className={dialogSize.lg}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Replace className="h-5 w-5 text-accent" /> Sustituir CFDI {numero ?? ""}
          </DialogTitle>
          <DialogDescription>
            Sustitución SAT motivo 01. Se crea una nueva factura que referenciará a la original,
            y al timbrarla se cancela la original enlazándolas.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-3 text-sm">
            <p>
              Se clonará la factura <strong>{numero}</strong> como un nuevo borrador. Podrás editar
              conceptos, cliente y demás datos antes de timbrar.
            </p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Crear borrador sustituto.</li>
              <li>Editar y timbrar el nuevo CFDI.</li>
              <li>Confirmar la cancelación de la original (motivo 01).</li>
            </ol>
            {!uuidOriginal && (
              <p className="text-destructive text-xs">
                Esta factura no tiene UUID fiscal; no se puede sustituir.
              </p>
            )}
          </div>
        )}

        {step === "borrador" && nuevaId && (
          <div className="space-y-3 text-sm">
            <p>
              Borrador creado. Abre la nueva factura, edítala si es necesario y timbrarla.
            </p>
            <a
              href={`/facturacion/${nuevaId}?accion=timbrar`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent underline"
            >
              Abrir factura sustituta <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-xs text-muted-foreground">
              Cuando la nueva factura esté timbrada, vuelve aquí y continúa.
            </p>
          </div>
        )}

        {step === "confirmar" && (
          <div className="space-y-3 text-sm">
            <p>
              Se cancelará el CFDI <strong>{numero}</strong> con motivo SAT 01 referenciando
              al UUID de la sustituta. Esta acción no se puede deshacer.
            </p>
            <p className="text-xs text-muted-foreground">
              Si la sustituta no está timbrada aún, FacturApi rechazará la cancelación.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>

          {step === "intro" && (
            <Button onClick={handleDuplicar} disabled={duplicando || !uuidOriginal}>
              {duplicando ? "Creando…" : (<>Crear borrador sustituto <ArrowRight className="h-4 w-4 ml-1" /></>)}
            </Button>
          )}

          {step === "borrador" && (
            <Button onClick={() => setStep("confirmar")}>
              Ya está timbrada <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === "confirmar" && (
            <Button variant="destructive" onClick={handleCancelarOriginal} disabled={cancelar.isPending}>
              <Ban className="h-4 w-4 mr-1" />
              {cancelar.isPending ? "Cancelando…" : "Cancelar original"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
