import { Button } from "@/components/ui/button";
import { Loader2, FileSpreadsheet, ArrowLeft, ArrowRight } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useDialogGenerarProformaController } from "@/features/embarques/hooks";
import { PasoSeleccionConceptos } from "./proforma/PasoSeleccionConceptos";
import { PasoConfirmacionProforma } from "./proforma/PasoConfirmacionProforma";
import { AvisoTcRequerido } from "./proforma/AvisoTcRequerido";
import type { Tables } from "@/types/db";
import type { FiltroContenedor } from "@/lib/domain/conceptosPorContenedor";

type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  embarque: EmbarqueRow;
  conceptosPendientes: ConceptoVenta[];
  /** v12.14.0: filtro inicial al abrir (atajo "Por contenedor"). Default 'todos'. */
  initialFiltroContenedor?: FiltroContenedor;
}

export function DialogGenerarProforma({ open, onOpenChange, embarque, conceptosPendientes, initialFiltroContenedor = 'todos' }: Props) {
  const c = useDialogGenerarProformaController(
    open, embarque, conceptosPendientes, () => onOpenChange(false),
    initialFiltroContenedor,
  );

  const isSeleccion = c.paso === 'seleccion';

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileSpreadsheet}
      title={isSeleccion ? "Generar Proforma" : "Confirmar Proforma"}
      description={
        isSeleccion
          ? "Selecciona los conceptos y decide si aplica IVA en cada uno (MXN siempre lleva IVA)."
          : "Revisa el resumen final antes de confirmar. Aún no se ha generado nada."
      }
      size="3xl"
      step={isSeleccion ? 1 : 2}
      totalSteps={2}
      stepLabels={["Selección", "Confirmación"]}
      footer={
        isSeleccion ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => c.setPaso('confirmacion')} disabled={c.totalSeleccionados === 0}>
              Revisar Proforma <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => c.setPaso('seleccion')} disabled={c.isPending}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
            <Button onClick={c.handleConfirmar} disabled={c.isPending}>
              {c.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
              ) : (
                <><FileSpreadsheet className="h-4 w-4 mr-2" /> Confirmar y Generar</>
              )}
            </Button>
          </>
        )
      }
    >
      {isSeleccion ? (
        <PasoSeleccionConceptos
          conceptosPendientes={conceptosPendientes}
          conceptosVisibles={c.conceptosVisibles}
          contenedores={c.contenedores}
          filtroContenedor={c.filtroContenedor}
          onFiltroContenedorChange={c.setFiltroContenedor}
          seleccionados={c.seleccionados}
          ivaPorConcepto={c.ivaPorConcepto}
          totales={c.totales}
          tasaIva={c.tasaIva}
          notas={c.notas}
          onToggle={c.toggle}
          onToggleAll={c.toggleAll}
          onToggleIva={c.toggleIva}
          onNotasChange={c.setNotas}
        />
      ) : (
        <PasoConfirmacionProforma
          conceptosSeleccionados={c.conceptosSeleccionados}
          ivaPorConcepto={c.ivaPorConcepto}
          totales={c.totales}
          tasaIva={c.tasaIva}
          notas={c.notas}
        />
      )}

      {c.tcRequerido && (
        <AvisoTcRequerido
          tcSugerido={c.tcSugerido}
          guardando={c.guardandoTc}
          onGuardarYReintentar={(tc) => void c.handleGuardarTcYReintentar(tc)}
        />
      )}

    </FormDialogShell>
  );
}
