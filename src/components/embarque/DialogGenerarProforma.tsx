import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { useDialogGenerarProformaController } from "@/hooks/embarque/useDialogGenerarProformaController";
import { PasoSeleccionConceptos } from "./proforma/PasoSeleccionConceptos";
import { PasoConfirmacionProforma } from "./proforma/PasoConfirmacionProforma";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  embarque: EmbarqueRow;
  conceptosPendientes: ConceptoVenta[];
}

export function DialogGenerarProforma({ open, onOpenChange, embarque, conceptosPendientes }: Props) {
  const c = useDialogGenerarProformaController(
    open, embarque, conceptosPendientes, () => onOpenChange(false),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {c.paso === 'seleccion' ? (
              <>Generar Proforma <Badge variant="outline">Paso 1 de 2</Badge></>
            ) : (
              <>Confirmar Proforma <Badge variant="outline">Paso 2 de 2</Badge></>
            )}
          </DialogTitle>
          <DialogDescription>
            {c.paso === 'seleccion'
              ? 'Selecciona los conceptos y decide si aplica IVA en cada uno (MXN siempre lleva IVA).'
              : 'Revisa el resumen final antes de confirmar. Aún no se ha generado nada.'}
          </DialogDescription>
        </DialogHeader>

        {c.paso === 'seleccion' && (
          <PasoSeleccionConceptos
            conceptosPendientes={conceptosPendientes}
            seleccionados={c.seleccionados}
            ivaPorConcepto={c.ivaPorConcepto}
            totales={c.totales}
            tasaIva={c.tasaIva}
            notas={c.notas}
            diasCredito={c.diasCredito}
            operadorEmbarque={embarque.operador}
            onToggle={c.toggle}
            onToggleAll={c.toggleAll}
            onToggleIva={c.toggleIva}
            onNotasChange={c.setNotas}
            onDiasCreditoChange={c.setDiasCredito}
          />
        )}

        {c.paso === 'confirmacion' && (
          <PasoConfirmacionProforma
            conceptosSeleccionados={c.conceptosSeleccionados}
            ivaPorConcepto={c.ivaPorConcepto}
            totales={c.totales}
            tasaIva={c.tasaIva}
            notas={c.notas}
            diasCredito={c.diasCredito}
            operadorEmbarque={embarque.operador}
          />
        )}

        <DialogFooter>
          {c.paso === 'seleccion' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => c.setPaso('confirmacion')}
                disabled={c.totalSeleccionados === 0}
              >
                Revisar Proforma <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => c.setPaso('seleccion')}
                disabled={c.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver
              </Button>
              <Button onClick={c.handleConfirmar} disabled={c.isPending}>
                {c.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" /> Confirmar y Generar</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
