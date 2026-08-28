/**
 * Registrar una nueva nota de crédito de proveedor contra una factura.
 * v13.305.11 · Soporta carga automática desde XML CFDI (nota de crédito
 * mexicana) además de la captura manual existente.
 */
import { useState } from "react";
import { format } from "date-fns";
import { FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { formatCurrency } from "@/lib/formatters";
import { useCrearNotaCredito } from "@/features/cxp/hooks/useNotasCreditoProveedor";
import { useOrgFilter } from "@/hooks/shared";
import { subirArchivosNcProveedor } from "@/features/cxp/services";
import { NuevaNotaCreditoFormFields } from "./NuevaNotaCreditoFormFields";
import { buildNcPrefillFromCfdi } from "./ncFromCfdi";
import {
  esCruceNoConvertible,
  montoNcEnMonedaFactura,
} from "./ncMonedaProveedor";
import { notifyError } from "@/lib/ui/appFeedback";
import type {
  MotivoNotaCreditoProveedor as MotivoNC,
  MonedaNotaCreditoProveedor as MonedaNC,
} from "@/features/cxp/types";
import type { CfdiParsedResponse } from "@/features/cxp/services";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  monedaFactura: MonedaNC;
  saldoFactura: number;
}

export function DialogNotaCreditoProveedor({ open, onOpenChange, facturaId, monedaFactura, saldoFactura }: Props) {
  const [mode, setMode] = useState<"manual" | "cfdi">("manual");
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<MonedaNC>(monedaFactura);
  const [tipoCambio, setTipoCambio] = useState("");
  const [motivo, setMotivo] = useState<MotivoNC>("Bonificacion");
  const [descripcion, setDescripcion] = useState("");
  const [parsedCfdi, setParsedCfdi] = useState<CfdiParsedResponse | null>(null);
  const [cfdiFiles, setCfdiFiles] = useState<{ xml: File | null; pdf: File | null }>({ xml: null, pdf: null });
  const [uuidFiscal, setUuidFiscal] = useState<string | null>(null);
  const crear = useCrearNotaCredito(facturaId);
  const { organizationId } = useOrgFilter();

  const montoNum = Number(monto);
  const tcNum = tipoCambio.trim() ? Number(tipoCambio) : null;
  const cruceInvalido = esCruceNoConvertible(moneda, monedaFactura);
  // v13.779.0 · H8-B: el tope se compara SIEMPRE en la moneda de la factura.
  const montoEnFactura = montoNcEnMonedaFactura(montoNum, moneda, monedaFactura, tcNum);
  const excede = montoEnFactura !== null && montoEnFactura > saldoFactura + 0.01;
  const valido = Boolean(folio.trim()) && Boolean(fecha) && montoNum > 0 && !excede && !cruceInvalido;

  const reset = () => {
    setMode("manual");
    setFolio("");
    setFecha(format(new Date(), "yyyy-MM-dd"));
    setMonto("");
    setMoneda(monedaFactura);
    setTipoCambio("");
    setMotivo("Bonificacion");
    setDescripcion("");
    setParsedCfdi(null);
    setCfdiFiles({ xml: null, pdf: null });
    setUuidFiscal(null);
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  };

  const handleCfdiParsed = (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => {
    const prefill = buildNcPrefillFromCfdi(data);
    setFolio(prefill.folio);
    setFecha(prefill.fecha);
    setMonto(prefill.monto);
    if (prefill.moneda) setMoneda(prefill.moneda);
    setDescripcion(prefill.descripcion);
    setUuidFiscal(prefill.uuidFiscal);
    setParsedCfdi(data);
    setCfdiFiles({ xml: files.xml, pdf: files.pdf });
  };

  const onSubmit = async () => {
    const payload = {
      proveedor_factura_id: facturaId,
      folio_nc: folio.trim(),
      fecha,
      monto: montoNum,
      moneda,
      tipo_cambio: tcNum,
      motivo,
      descripcion,
      estado: "Borrador" as const,
      uuid_fiscal: uuidFiscal,
    };

    try {
      const created = await crear.mutateAsync(payload);
      if (created?.id && (cfdiFiles.xml || cfdiFiles.pdf)) {
        try {
          await subirArchivosNcProveedor({
            ncId: created.id,
            organizationId,
            xmlFile: cfdiFiles.xml,
            pdfFile: cfdiFiles.pdf,
          });
        } catch (uploadErr) {
          notifyError(undefined, {
            title: "NC registrada, pero no se pudieron subir los adjuntos.",
            error: uploadErr,
            method: "DIALOG_NC_PROV_UPLOAD",
          });
        }
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      // El error ya lo muestra useCrearNotaCredito; no duplicar toast.
      // SAFECAST: no propagamos el error para evitar doble toast.
      void err;
    }
  };

  const motivoLabel = ["Devolución", "Bonificación", "Descuento", "Error de facturación", "Cancelación", "Otro"][
    ["Devolucion", "Bonificacion", "Descuento", "ErrorFacturacion", "Cancelacion", "Otro"].indexOf(motivo)
  ] ?? "—";

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button disabled={!valido || crear.isPending} onClick={onSubmit}>
        {crear.isPending ? "Guardando…" : "Registrar"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={FileMinus}
      title="Registrar nota de crédito"
      description="Emite una NC contra el saldo pendiente de la factura seleccionada."
      size="lg"
      footer={footer}
    >
      <div className="grid grid-cols-3 gap-2.5 -mt-1">
        <Kpi
          label="Saldo factura"
          value={formatCurrency(saldoFactura, monedaFactura)}
          tone={saldoFactura > 0.01 ? "warn" : "default"}
          emphasis
        />
        <Kpi label="Moneda" value={monedaFactura} />
        <Kpi label="Motivo" value={motivoLabel} />
      </div>

      <NuevaNotaCreditoFormFields
        mode={mode}
        onModeChange={setMode}
        parsedCfdi={parsedCfdi}
        onCfdiParsed={handleCfdiParsed}
        folio={folio}
        onFolioChange={setFolio}
        fecha={fecha}
        onFechaChange={setFecha}
        monto={monto}
        onMontoChange={setMonto}
        motivo={motivo}
        onMotivoChange={setMotivo}
        descripcion={descripcion}
        onDescripcionChange={setDescripcion}
        monedaFactura={monedaFactura}
        saldoFactura={saldoFactura}
        moneda={moneda}
        onMonedaChange={setMoneda}
        tipoCambio={tipoCambio}
        onTipoCambioChange={setTipoCambio}
      />

      {cruceInvalido && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive">
          No existe tipo de cambio entre {moneda} y {monedaFactura}. Captura la nota de crédito en{" "}
          {monedaFactura} o en MXN.
        </div>
      )}

      {!cruceInvalido && moneda !== monedaFactura && montoEnFactura === null && montoNum > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-body-sm text-muted-foreground">
          Al guardar se aplicará el tipo de cambio del DOF de la fecha de la NC para valuarla en{" "}
          {monedaFactura}.
        </div>
      )}

      {!cruceInvalido && moneda !== monedaFactura && montoEnFactura !== null && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-body-sm text-muted-foreground">
          Equivale a {formatCurrency(montoEnFactura, monedaFactura)} contra el saldo de la factura.
        </div>
      )}

      {excede && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive">
          El monto de la nota de crédito excede el saldo pendiente de la factura.
        </div>
      )}
    </FormDialogShell>
  );
}
