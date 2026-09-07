/**
 * Captura de factura de proveedor: manual, por XML CFDI, por PDF con IA o
 * desde el buzón CxP (v13.366.0).
 * v13.712.0 — Wizard de 3 pasos (documento y conceptos · datos de la factura ·
 * vinculación al embarque). Cada paso usa todo el ancho del modal para que la
 * tabla de conceptos y los campos dejen de aparecer truncados.
 */
import { useCallback, useRef } from "react";
import { FileSpreadsheet } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { usePermissions } from "@/hooks/shared";
import { useDirtyGuard } from "@/hooks/shared/useDirtyGuard";
import { DialogFacturaProveedorSinPermiso } from "@/features/cxp/components/DialogFacturaProveedorSinPermiso";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { CuadreConceptosBar } from "./CuadreConceptosBar";
import { TotalesChipDesglose } from "./TotalesChipDesglose";
import { CapturaFacturaFooter } from "./CapturaFacturaFooter";
import { CapturaFacturaPasosBody } from "./_sections/CapturaFacturaPasosBody";

import { useCuadreCaptura } from "@/features/cxp/hooks/useCuadreCaptura";
import { useModoBuzonWiring } from "@/features/cxp/hooks/useModoBuzonWiring";
import { useCapturaFacturaPasos } from "@/features/cxp/hooks/useCapturaFacturaPasos";
import { pendientesDeCaptura } from "./pendientesDeCaptura";
import { derivarMontos, hayCapturaFactura, conceptosConDatos } from "./_sections/capturaDerivados";

import { useCapturaEntranteWiring } from "@/features/cxp/hooks/useCapturaEntranteWiring";
import type { EmbarqueSeleccionado, EntranteParaCaptura } from "@/features/cxp/types";


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null;
  /** v13.366.0 — Captura desde el buzón CxP: precarga y marca el documento. */
  entrante?: EntranteParaCaptura | null;
  onCapturada?: () => void;
}

/**
 * R-05.2: puerta de permisos. Sin capacidad de captura mostramos el motivo en
 * vez de un formulario que la base de datos rechazará al guardar.
 */
export function DialogNuevaFacturaProveedor(props: Props) {
  const { canCapturarFacturaProveedor } = usePermissions();
  if (!canCapturarFacturaProveedor) {
    return <DialogFacturaProveedorSinPermiso open={props.open} onOpenChange={props.onOpenChange} />;
  }
  return <DialogNuevaFacturaProveedorForm {...props} />;
}

function DialogNuevaFacturaProveedorForm({
  open, onOpenChange, initialEmbarqueAdHoc, entrante, onCapturada,
}: Props) {
  
  const cats = usePresupuestoCategorias(true);
  // v13.819.3 — `ctlRef` permite que TODO cierre (incluido el del buzón tras
  // guardar) resetee el wizard: si no, el borrador y los renglones vacíos
  // sobrevivían y reaparecían en la siguiente apertura.
  const ctlRef = useRef<{ reset: () => void } | null>(null);
  const cerrarYLimpiar = useCallback(() => {
    ctlRef.current?.reset();
    onOpenChange(false);
  }, [onOpenChange]);
  const wiring = useCapturaEntranteWiring({
    entrante, initialEmbarqueAdHoc, onCapturada,
    onCerrar: cerrarYLimpiar,
  });
  const ctl = useNuevaFacturaProveedorForm(wiring.onDone, wiring.embarqueInicial);
  ctlRef.current = ctl;
  const { autocarga, categoriaCogs, herencia } = useModoBuzonWiring({
    ctl, categorias: cats.data ?? [], entrante, abierto: open,
  });

  const modoBuzon = Boolean(entrante);
  const { sub, iva, ieps, ret } = derivarMontos(ctl.values);
  const moneda = ctl.values.moneda;

  // FE-11: si ya hay captura, avisamos antes de navegar o cerrar la pestaña.
  const hayCaptura = hayCapturaFactura({
    provId: ctl.values.provId,
    folio: ctl.values.folio,
    subtotal: sub,
    conceptos: conceptosConDatos(ctl.conceptosManuales.conceptos),
  });
  const { guardDialog } = useDirtyGuard(open && hayCaptura && !ctl.isPending);

  const { conceptosParaCuadre, cuadre, keyRenglonSospechoso } = useCuadreCaptura({
    subtotal: sub,
    cfdiConceptos: ctl.cfdiConceptos,
    conceptosManuales: ctl.conceptosManuales.conceptos,
    vinculos: ctl.vinculos,
  });

  const pendientes = pendientesDeCaptura({
    values: ctl.values,
    total: ctl.total,
    topeExcedido: ctl.topeVinculacion.excede,
    cfdiDuplicado: !!ctl.cfdiDuplicado,
    avisoMontoDeclarado: entrante
      ? { montoDeclarado: entrante.montoDeclarado, monedaDeclarada: entrante.monedaDeclarada }
      : undefined,
    sinVinculos: modoBuzon && Object.keys(ctl.vinculos).length === 0,
  });

  const pasos = useCapturaFacturaPasos({ abierto: open, pendientes });

  const footer = (
    <CapturaFacturaFooter
      pasos={pasos}
      guardando={ctl.isPending}
      puedeGuardar={ctl.puedeGuardar}
      onCancelar={cerrarYLimpiar}
      // Con una factura ya creada y pendiente de marcarse como capturada,
      // "Guardar" reintenta sólo ese paso (nunca vuelve a insertar la factura).
      onGuardar={() =>
        wiring.facturaIdPendiente ? wiring.reintentar() : void ctl.submit()
      }
    />
  );

  return (
    <>
    {guardDialog}
    <FormDialogShell
        open={open}
        onOpenChange={(o) => { if (!o) { ctl.reset(); } onOpenChange(o); }}
        icon={FileSpreadsheet}
        title="Capturar factura de proveedor"
        description={
          modoBuzon
            ? "Verifica los datos que se leyeron del documento antes de guardar."
            : "Registra la factura recibida. Si el proveedor es mexicano, sube el XML CFDI y se prellenará."
        }
        size="5xl"
        footer={footer}
        // YG-04: con captura en curso, cerrar por X/Escape/clic exterior pide confirmación.
        isDirty={hayCaptura}
        stepper={{ step: pasos.paso, totalSteps: pasos.totalPasos, labels: [...pasos.etiquetas] }}
        headerAside={
          <TotalesChipDesglose
            subtotal={sub} iva={iva} ieps={ieps} retenciones={ret}
            total={ctl.total} moneda={moneda}
          />
        }
        stickyBottom={
          pasos.paso === 1 ? (
            <CuadreConceptosBar
              resultado={cuadre}
              subtotal={sub}
              moneda={moneda}
              renglones={conceptosParaCuadre.length}
              ivaGlobal={iva}
              totalDocumento={ctl.total}
            />
          ) : undefined
        }
      >
        <CapturaFacturaPasosBody
          ctl={ctl}
          pasos={pasos}
          categorias={cats.data ?? []}
          entrante={entrante ?? null}
          autocarga={autocarga}
          categoriaCogs={categoriaCogs}
          herencia={herencia}
          keyRenglonSospechoso={keyRenglonSospechoso}
          modoBuzon={modoBuzon}
          onCerrar={cerrarYLimpiar}
        />

    </FormDialogShell>
    </>
  );
}
