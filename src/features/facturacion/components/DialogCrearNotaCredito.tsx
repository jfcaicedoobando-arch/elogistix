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
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { NotaCreditoCamposFiscales } from "./detalle/NotaCreditoCamposFiscales";
import { NotaCreditoConceptosEditor } from "./detalle/NotaCreditoConceptosEditor";
import { useNotaCreditoDraft, makeConcepto } from "../hooks/useNotaCreditoDraft";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"factura_notas_credito">["moneda"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  facturaNumero: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
  /** Conceptos sugeridos desde la factura original (snapshot). */
  conceptosSugeridos?: ConceptoNotaCredito[];
}

export function DialogCrearNotaCredito(props: Props) {
  const s = useNotaCreditoDraft(props);
  const {
    open, onOpenChange, facturaNumero, monedaFactura, saldoFactura,
  } = props;

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={s.guardando}>Cancelar</Button>
      <Button variant="secondary" onClick={() => s.handleSubmit(false)} disabled={!s.puedeGuardar || s.guardando}>
        Guardar borrador
      </Button>
      <Button onClick={() => s.handleSubmit(true)} disabled={!s.puedeTimbrar || s.guardando}>
        {s.guardando ? "Procesando…" : "Guardar y timbrar"}
      </Button>
    </>
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
