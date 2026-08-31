/**
 * Footer del wizard "Capturar factura de proveedor" (v13.712.0).
 * Atrás / Continuar en los pasos 1-2 y Guardar factura sólo en el paso 3.
 * Los pendientes de otros pasos son botones que saltan al paso que los resuelve.
 */
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CapturaPasos } from "@/features/cxp/hooks/useCapturaFacturaPasos";
import { useFormDialogCerrar } from "@/components/shared/formDialogCloseContext";

interface Props {
  pasos: CapturaPasos;
  guardando: boolean;
  puedeGuardar: boolean;
  /** Fallback cuando el footer se usa fuera de un `FormDialogShell`. */
  onCancelar: () => void;
  onGuardar: () => void;
}

export function CapturaFacturaFooter({
  pasos, guardando, puedeGuardar, onCancelar, onGuardar,
}: Props) {
  // v13.819.3 — "Cancelar" pasa por el cierre guardado del shell: con captura
  // real pide confirmación en vez de descartar en silencio.
  const cerrarGuardado = useFormDialogCerrar();
  const delPaso = pasos.paso === 1
    ? pasos.pendientesPorPaso.documento
    : pasos.paso === 2
      ? pasos.pendientesPorPaso.datos
      : pasos.pendientesPorPaso.vinculacion;

  return (
    <>
      <div className="mr-auto flex min-w-0 flex-col gap-1" aria-live="polite">
        {delPaso.length > 0 && (
          <p className="flex items-start gap-1.5 text-body-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <span>{delPaso.join(" · ")}</span>
          </p>
        )}
        {pasos.pendientesDeOtrosPasos.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted-foreground">
            {pasos.pendientesDeOtrosPasos.map((p) => (
              <button
                key={p.texto}
                type="button"
                onClick={() => pasos.irA(p.paso)}
                className="underline-offset-4 hover:underline hover:text-foreground"
              >
                {p.texto} (paso {p.paso})
              </button>
            ))}
          </div>
        )}
      </div>

      {!pasos.esPrimero && (
        <Button variant="ghost" onClick={pasos.anterior} disabled={guardando}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Atrás
        </Button>
      )}

      <Button type="button" variant="outline" onClick={cerrarGuardado ?? onCancelar} disabled={guardando}>
        Cancelar
      </Button>

      {pasos.esUltimo ? (
        <Button onClick={onGuardar} disabled={!puedeGuardar} loading={guardando}>
          {guardando ? "Guardando…" : "Guardar factura"}
        </Button>
      ) : (
        <Button onClick={pasos.siguiente}>
          Continuar
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </Button>
      )}
    </>
  );
}
