/**
 * DialogCrearNotaCredito — captura una NC (CFDI tipo E) ligada a una factura
 * y opcionalmente la timbra de inmediato vía FacturApi.
 *
 * Patrón: `FormDialogShell` (memoria `mem://style/form-dialog-shell`).
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useToast } from "@/hooks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  crearNotaCredito,
  type ConceptoNotaCredito,
} from "@/features/facturacion/services/notasCredito";
import { useTimbrarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors/index";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { NotaCreditoCamposFiscales } from "./detalle/NotaCreditoCamposFiscales";
import { NotaCreditoConceptosEditor } from "./detalle/NotaCreditoConceptosEditor";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"factura_notas_credito">["moneda"];
type Motivo = Tables<"factura_notas_credito">["motivo"];

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

const CLAVE_SAT_DEFAULT = "84111506"; const CLAVE_UNIDAD_DEFAULT = "E48";

function makeConcepto(): ConceptoNotaCredito {
  return {
    descripcion: "",
    cantidad: 1,
    precio_unitario: 0,
    clave_sat: CLAVE_SAT_DEFAULT,
    clave_unidad: CLAVE_UNIDAD_DEFAULT,
    unidad: "Unidad de servicio",
    tasa_iva: 0.16,
  };
}

export function DialogCrearNotaCredito({
  open, onOpenChange, facturaId, facturaNumero, monedaFactura, tipoCambioFactura,
  saldoFactura, uuidFacturaOriginal, conceptosSugeridos,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const timbrar = useTimbrarNotaCredito(facturaId);

  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [motivo, setMotivo] = useState<Motivo>("Descuento");
  const [descripcion, setDescripcion] = useState("");
  const [usoCfdi, setUsoCfdi] = useState("G02");
  const [formaPago, setFormaPago] = useState("03");
  const [conceptos, setConceptos] = useState<ConceptoNotaCredito[]>(() =>
    conceptosSugeridos?.length ? conceptosSugeridos.map((c) => ({ ...c })) : [makeConcepto()],
  );
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setConceptos(conceptosSugeridos?.length ? conceptosSugeridos.map((c) => ({ ...c })) : [makeConcepto()]);
    }
  }, [open, conceptosSugeridos]);

  const monto = useMemo(
    () => conceptos.reduce((acc, c) => acc + Number(c.cantidad) * Number(c.precio_unitario), 0),
    [conceptos],
  );

  const excedeSaldo = monto > saldoFactura + 0.01;
  const facturaLiquidada = saldoFactura <= 0.01;
  const sinUuid = !uuidFacturaOriginal;
  const conceptosValidos =
    conceptos.length > 0 &&
    conceptos.every((c) => c.descripcion.trim() && c.cantidad > 0 && c.precio_unitario >= 0);
  const puedeGuardar = !!descripcion.trim() && conceptosValidos && monto > 0 && !excedeSaldo && !facturaLiquidada;
  const puedeTimbrar = puedeGuardar && !sinUuid;

  // v13.213.20 — sin folio de entrada: el servicio asigna `BORRADOR-<ts>`.
  const crearMut = useMutation({
    mutationFn: () => crearNotaCredito({
      factura_id: facturaId,
      motivo,
      descripcion: descripcion.trim(),
      monto,
      moneda: monedaFactura,
      tipo_cambio: tipoCambioFactura || 1,
      fecha_emision: fecha,
      uso_cfdi: usoCfdi,
      forma_pago: formaPago,
      conceptos,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: facturasKeys.notasCreditoRecientes() });
    },
  });

  const handleSubmit = async (timbrarAhora: boolean) => {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const nueva = await crearMut.mutateAsync();
      toast({
        title: "Borrador de nota de crédito creado",
        description: timbrarAhora
          ? "Se timbrará ahora y FacturAPI asignará el folio fiscal."
          : "El folio fiscal se asignará al timbrar.",
      });
      if (timbrarAhora && !sinUuid) await timbrar.mutateAsync(nueva.id);
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo crear la nota de crédito",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    } finally {
      setGuardando(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
      <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={!puedeGuardar || guardando}>
        Guardar borrador
      </Button>
      <Button onClick={() => handleSubmit(true)} disabled={!puedeTimbrar || guardando}>
        {guardando ? "Procesando…" : "Guardar y timbrar"}
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
      {facturaLiquidada && (
        <Alert variant="destructive">
          <AlertDescription>
            La factura ya está liquidada. No se pueden emitir notas de crédito sobre facturas sin saldo pendiente.
          </AlertDescription>
        </Alert>
      )}

      {sinUuid && (
        <Alert variant="destructive">
          <AlertDescription>
            La factura original aún no está timbrada. Puedes guardar el borrador,
            pero no podrás timbrar la NC hasta que la factura tenga UUID fiscal.
          </AlertDescription>
        </Alert>
      )}

      <NotaCreditoCamposFiscales
        fecha={fecha} setFecha={setFecha}
        motivo={motivo} setMotivo={setMotivo}
        usoCfdi={usoCfdi} setUsoCfdi={setUsoCfdi}
        formaPago={formaPago} setFormaPago={setFormaPago}
        descripcion={descripcion} setDescripcion={setDescripcion}
      />

      <NotaCreditoConceptosEditor
        conceptos={conceptos}
        monto={monto}
        monedaFactura={monedaFactura}
        excedeSaldo={excedeSaldo}
        onAdd={() => setConceptos((p) => [...p, makeConcepto()])}
        onUpdate={(i, patch) =>
          setConceptos((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
        }
        onRemove={(i) =>
          setConceptos((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
        }
      />
    </FormDialogShell>
  );
}
