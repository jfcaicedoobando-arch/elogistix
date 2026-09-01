/**
 * DialogCrearNotaCredito — captura una NC (CFDI tipo E) ligada a una factura
 * y opcionalmente la timbra de inmediato vía FacturApi.
 *
 * Estado y submit viven en `useNotaCreditoDraft` (Power of 10 ≤ 200).
 */
import { FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogCancelarBoton } from "@/components/shared/FormDialogCancelarBoton";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { NotaCreditoCamposFiscales } from "./detalle/NotaCreditoCamposFiscales";
import { NotaCreditoConceptosEditor } from "./detalle/NotaCreditoConceptosEditor";
import { FaltantesHint } from "./FaltantesHint";
import { useNotaCreditoDraft, makeConcepto } from "../hooks/useNotaCreditoDraft";
import type { MonedaNotaCredito as Moneda } from "@/features/facturacion/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  facturaNumero: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
  /** B-24: fecha de emisión de la factura original (cota inferior de la NC). */
  fechaFactura?: string | null;
  /** Conceptos sugeridos desde la factura original (snapshot). */
  conceptosSugeridos?: ConceptoNotaCredito[];
}

export function DialogCrearNotaCredito(props: Props) {
  const s = useNotaCreditoDraft(props);
  const {
    open, onOpenChange, facturaNumero, monedaFactura, saldoFactura, fechaFactura,
  } = props;

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {!s.puedeTimbrar && <FaltantesHint items={s.faltantesTimbrar} className="mr-auto" />}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* v13.821.7 — Cancelar pasa por el cierre guardado del shell: con
            captura sin guardar pide confirmación en vez de descartar directo. */}
        <FormDialogCancelarBoton onCancelar={() => onOpenChange(false)} disabled={s.guardando} />
        <Button variant="secondary" onClick={() => s.handleSubmit(false)} disabled={!s.puedeGuardar || s.guardando}>
          Guardar borrador
        </Button>
        <Button onClick={() => s.handleSubmit(true)} disabled={!s.puedeTimbrar || s.guardando}>
          {s.guardando ? "Procesando…" : "Guardar y timbrar"}
        </Button>
      </div>
    </div>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileMinus}
      title={`Nueva nota de crédito · ${facturaNumero}`}
      description={
        <>
          Saldo de la factura:{" "}
          <strong className="tabular-nums">{saldoFactura.toFixed(2)} {monedaFactura}</strong>
        </>
      }
      size="lg"
      footer={footer}
      // YG-04: con descripción o conceptos capturados, cerrar pide confirmación.
      isDirty={s.isDirty}
    >
      {s.facturaLiquidada && (
        <Alert variant="destructive">
          <AlertDescription>
            La factura ya está liquidada. No se pueden emitir notas de crédito sobre facturas sin saldo pendiente.
          </AlertDescription>
        </Alert>
      )}

      {s.sinUuid && (
        <Alert variant="destructive">
          <AlertDescription>
            La factura original aún no está timbrada. Puedes guardar el borrador,
            pero no podrás timbrar la NC hasta que la factura tenga UUID fiscal.
          </AlertDescription>
        </Alert>
      )}

      <NotaCreditoCamposFiscales
        fechaMinima={fechaFactura}
        fecha={s.fecha} setFecha={s.setFecha}
        motivo={s.motivo} setMotivo={s.setMotivo}
        usoCfdi={s.usoCfdi} setUsoCfdi={s.setUsoCfdi}
        formaPago={s.formaPago} setFormaPago={s.setFormaPago}
        descripcion={s.descripcion} setDescripcion={s.setDescripcion}
      />

      <NotaCreditoConceptosEditor
        conceptos={s.conceptos}
        monto={s.monto}
        monedaFactura={monedaFactura}
        excedeSaldo={s.excedeSaldo}
        onAdd={() => s.setConceptos((p) => [...p, makeConcepto()])}
        onUpdate={(i, patch) =>
          s.setConceptos((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
        }
        onRemove={(i) =>
          s.setConceptos((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
        }
      />
    </FormDialogShell>
  );
}
