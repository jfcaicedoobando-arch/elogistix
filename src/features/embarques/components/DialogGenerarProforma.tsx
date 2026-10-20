import { useNavigate } from "react-router";
import { FileSpreadsheet } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useDialogGenerarProformaController } from "@/features/embarques/hooks";
import { PasoSeleccionConceptos } from "./proforma/PasoSeleccionConceptos";
import { PasoConfirmacionProforma } from "./proforma/PasoConfirmacionProforma";
import { AvisoTcRequerido } from "./proforma/AvisoTcRequerido";
import { ProformaDialogFooter } from "./proforma/ProformaDialogFooter";
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
      onOpenChange={(v) => { if (!c.isPending) onOpenChange(v); }}
      icon={FileSpreadsheet}
      title={isSeleccion ? "Generar Proforma" : "Confirmar Proforma"}
      description={
        isSeleccion
          ? "Selecciona los conceptos. El IVA se conserva tal como está clasificado en los datos del embarque."
          : c.creada ? `Proforma ${c.creada.proforma.numero} creada; descarga pendiente.` : "Revisa el resumen final antes de confirmar. Aún no se ha generado nada."
      }
      size="3xl"
      stepper={{ step: isSeleccion ? 1 : 2, totalSteps: 2, labels: ["Selección", "Confirmación"] }}
      footer={<ProformaDialogFooter c={c} onClose={() => onOpenChange(false)} />}
    >
      {isSeleccion ? (
        <PasoSeleccionConceptos
          conceptosPendientes={conceptosPendientes}
          conceptosVisibles={c.conceptosVisibles}
          contenedores={c.contenedores}
          filtroContenedor={c.filtroContenedor}
          onFiltroContenedorChange={c.setFiltroContenedor}
          seleccionados={c.seleccionados}
          totales={c.totales}
          tasaIva={c.tasaIva}
          notas={c.notas}
          onToggle={c.toggle}
          onToggleAll={c.toggleAll}
          onNotasChange={c.setNotas}
          pendientesIva={c.pendientesIva}
          onEditarConceptos={() => {
            onOpenChange(false);
            navigate(`/embarques/${embarque.id}/editar?step=3`);
          }}
        />
      ) : (
        <PasoConfirmacionProforma
          conceptosSeleccionados={c.creada?.conceptos ?? c.conceptosSeleccionados}
          totales={c.creada?.totales ?? c.totales}
          tasaIva={c.tasaIva}
          notas={c.creada?.notas ?? c.notas}
          pendientesIva={c.pendientesIva}
          numeroCreado={c.creada?.proforma.numero}
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
