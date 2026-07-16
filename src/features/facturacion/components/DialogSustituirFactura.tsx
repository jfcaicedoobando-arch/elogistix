/**
 * DialogSustituirFactura — Wizard de sustitución (motivo SAT 01).
 *
 * Flujo single-tab (post overhaul v13.301.0):
 *   1) Confirmar intención y duplicar la factura como borrador
 *      (RPC `duplicar_factura_para_sustitucion`).
 *   2) Navegar en la MISMA pestaña al detalle del borrador para editar/timbrar.
 *      El progreso se guarda en `sessionStorage` bajo la clave
 *      `sustitucion:{facturaId}` para que al volver a la factura original el
 *      diálogo se reabra en el paso "confirmar" y el usuario continúe.
 *   3) Confirmar cancelación del CFDI original referenciando a la sustituta;
 *      el backend marca la original como `Sustituida` (o pending si el SAT
 *      requiere aceptación del receptor).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { safeSessionStorage } from "@/lib/browserStorage";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  facturaId: string | null;
  numero?: string;
  uuidOriginal?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Step = "intro" | "confirmar";

interface PersistedState {
  nuevaId: string;
  ts: number;
}

const storageKey = (facturaId: string) => `sustitucion:${facturaId}`;

function readPersisted(facturaId: string): PersistedState | null {
  try {
    const raw = safeSessionStorage.getItem(storageKey(facturaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed?.nuevaId) return null;
    // Expira a las 24 h para no dejar borradores huérfanos.
    if (Date.now() - parsed.ts > 24 * 60 * 60 * 1000) {
      safeSessionStorage.removeItem(storageKey(facturaId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(facturaId: string, nuevaId: string) {
  safeSessionStorage.setItem(
    storageKey(facturaId),
    JSON.stringify({ nuevaId, ts: Date.now() } satisfies PersistedState),
  );
}

function clearPersisted(facturaId: string) {
  safeSessionStorage.removeItem(storageKey(facturaId));
}

export function DialogSustituirFactura({ facturaId, numero, uuidOriginal, open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [nuevaId, setNuevaId] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState(false);
  const navigate = useNavigate();
  const cancelar = useCancelarFactura();

  // Consulta el estado de la sustituta para decidir si "Cancelar original" está listo.
  // Si el borrador fue eliminado (returns null), limpiamos sessionStorage huérfano.
  const sustitutaQuery = useQuery({
    queryKey: ["factura-sustituta-estado", nuevaId],
    enabled: !!nuevaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturas")
        .select("id, estado, uuid_fiscal")
        .eq("id", nuevaId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Restaurar progreso al abrir el diálogo si ya existe borrador sustituto.
  useEffect(() => {
    if (!open || !facturaId) return;
    const persisted = readPersisted(facturaId);
    if (persisted) {
      setNuevaId(persisted.nuevaId);
      setStep("confirmar");
    } else {
      setNuevaId(null);
      setStep("intro");
    }
  }, [open, facturaId]);

  // Detectar borrador huérfano (eliminado externamente) y reiniciar automáticamente.
  useEffect(() => {
    if (step !== "confirmar" || !nuevaId || sustitutaQuery.isLoading) return;
    if (sustitutaQuery.data === null && facturaId) {
      clearPersisted(facturaId);
      toast.info("El borrador sustituto ya no existe. Reinicia el proceso.");
      setNuevaId(null);
      setStep("intro");
    }
  }, [step, nuevaId, sustitutaQuery.data, sustitutaQuery.isLoading, facturaId]);

  if (!facturaId) return null;

  const reset = () => { setStep("intro"); setNuevaId(null); };

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
    if (!nuevaId) return;
    onOpenChange(false);
    navigate(`/facturacion/${nuevaId}?accion=timbrar`);
  };

  const handleReiniciar = () => {
    clearPersisted(facturaId);
    reset();
  };

  const handleCancelarOriginal = () => {
    if (!nuevaId) return;
    cancelar.mutate(
      { facturaId, motivo: "01", sustituidaPorFacturaId: nuevaId },
      {
        onSuccess: () => {
          clearPersisted(facturaId);
          onOpenChange(false);
          reset();
        },
      },
    );
  };

  const sustitutaTimbrada = !!sustitutaQuery.data?.uuid_fiscal &&
    (sustitutaQuery.data.estado === "Timbrada" || sustitutaQuery.data.estado === "Emitida");
  const sustitutaEstadoLabel = sustitutaQuery.data?.estado ?? "…";

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

        {step === "intro" && (
          <div className="space-y-3 text-sm">
            <p>
              Se clonará la factura <strong>{numero}</strong> como un nuevo borrador. Al confirmar,
              te llevaremos directamente al detalle del borrador para que lo edites y timbres.
              Cuando vuelvas aquí (botón "Volver"), este diálogo reabrirá en el paso final para
              cancelar la original.
            </p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Crear borrador sustituto y navegar a él.</li>
              <li>Editar y timbrar el nuevo CFDI (en esta misma pestaña).</li>
              <li>Volver a esta factura y confirmar cancelación (motivo 01).</li>
            </ol>
            {!uuidOriginal && (
              <p className="text-destructive text-xs">
                Esta factura no tiene UUID fiscal; no se puede sustituir.
              </p>
            )}
          </div>
        )}

        {step === "confirmar" && (
          <div className="space-y-3 text-sm">
            <p>
              Ya existe un borrador sustituto para esta factura. Cuando esté timbrado,
              cancelaremos el CFDI <strong>{numero}</strong> con motivo SAT 01 referenciando
              al UUID de la sustituta.
            </p>
            <div className={`rounded-md border p-3 text-xs ${sustitutaTimbrada ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
              <strong>Estado de la sustituta:</strong>{" "}
              {sustitutaQuery.isLoading ? "Consultando…" : sustitutaEstadoLabel}
              {!sustitutaTimbrada && !sustitutaQuery.isLoading && (
                <div className="mt-1 text-muted-foreground">
                  Debe estar timbrada antes de cancelar la original.
                </div>
              )}
            </div>
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
              <strong>Nota:</strong> el SAT puede tardar hasta 72 h en aceptar la cancelación si el
              CFDI supera $1,000 MXN (regla 2.7.1.34). El sistema hará seguimiento automático.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>

          {step === "intro" && (
            <Button onClick={handleDuplicar} disabled={duplicando || !uuidOriginal}>
              {duplicando ? "Creando…" : (<>Crear borrador y continuar <ArrowRight className="h-4 w-4 ml-1" /></>)}
            </Button>
          )}

          {step === "confirmar" && (
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
                disabled={cancelar.isPending || !sustitutaTimbrada}
                title={!sustitutaTimbrada ? "La sustituta debe estar timbrada" : undefined}
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
