import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, ArrowLeft, ArrowRight } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useDialogGenerarProformaController } from "@/features/embarques/hooks";
import { PasoSeleccionConceptos } from "./proforma/PasoSeleccionConceptos";
import { PasoConfirmacionProforma } from "./proforma/PasoConfirmacionProforma";
import { AvisoTcRequerido } from "./proforma/AvisoTcRequerido";
import type { Tables } from "@/types/db";
import type { FiltroContenedor } from "@/features/embarques/domain/conceptosPorContenedor";

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
  const navigate = useNavigate();
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
          ? "Selecciona los conceptos. Si el IVA dice ‘Por confirmar’, clasifícalo en los datos del embarque. En los demás conceptos USD puedes ajustarlo aquí."
          : "Revisa el resumen final antes de confirmar. Aún no se ha generado nada."
      }
      size="3xl"
      stepper={{ step: isSeleccion ? 1 : 2, totalSteps: 2, labels: ["Selección", "Confirmación"] }}
      footer={
        isSeleccion ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => c.setPaso('confirmacion')} disabled={c.totalSeleccionados === 0 || c.pendientesIva.length > 0}>
              Revisar Proforma <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => c.setPaso('seleccion')} disabled={c.isPending}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
            <Button onClick={c.handleConfirmar} disabled={c.isPending || c.pendientesIva.length > 0} loading={c.isPending}>
              {c.isPending ? (
                "Generando…"
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
          pendientesIva={c.pendientesIva}
          onEditarConceptos={() => {
            onOpenChange(false);
            navigate(`/embarques/${embarque.id}/editar?step=3`);
          }}
        />
      ) : (
        <PasoConfirmacionProforma
          conceptosSeleccionados={c.conceptosSeleccionados}
          ivaPorConcepto={c.ivaPorConcepto}
          totales={c.totales}
          tasaIva={c.tasaIva}
          notas={c.notas}
          pendientesIva={c.pendientesIva}
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
