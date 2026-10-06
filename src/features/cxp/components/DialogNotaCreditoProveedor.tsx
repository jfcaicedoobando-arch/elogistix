/**
 * Registrar una nueva nota de crédito de proveedor contra una factura.
 * v13.305.11 · Soporta carga automática desde XML CFDI (nota de crédito
 * mexicana) además de la captura manual existente.
 */
import { baseNcProveedor } from "@/lib/financial/baseNcProveedor";
import { useState } from "react";
import { format } from "date-fns";
import { FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { formatCurrency } from "@/lib/formatters";
import { useCrearNotaCredito } from "@/features/cxp/hooks/useNotasCreditoProveedor";
import { useNcProveedorTipoCambio } from "@/features/cxp/hooks/useNcProveedorTipoCambio";
import { useOrgFilter } from "@/hooks/shared";
import { subirArchivosNcProveedor } from "@/features/cxp/services";
import { NuevaNotaCreditoFormFields } from "./NuevaNotaCreditoFormFields";
import { buildNcPrefillFromCfdi, origenNcValido, xmlNcVerificado } from "./ncFromCfdi";
import { esCruceNoConvertible, montoNcEnMonedaFactura } from "./ncMonedaProveedor";
import { construirNcProveedorPayload } from "./ncProveedorPayload";
import { NcProveedorAvisos } from "./NcProveedorAvisos";
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
  const [subtotal, setSubtotal] = useState("");
  const [moneda, setMoneda] = useState<MonedaNC>(monedaFactura);
  const [tipoCambio, setTipoCambio] = useState(""); // MXN por 1 unidad extranjera
  const [motivo, setMotivo] = useState<MotivoNC>("Bonificacion");
  const [descripcion, setDescripcion] = useState("");
  const [parsedCfdi, setParsedCfdi] = useState<CfdiParsedResponse | null>(null);
  const [cfdiFiles, setCfdiFiles] = useState<{ xml: File | null; pdf: File | null }>({ xml: null, pdf: null });
  const [uuidFiscal, setUuidFiscal] = useState<string | null>(null);
  const crear = useCrearNotaCredito(facturaId);
  const { organizationId } = useOrgFilter();
  const montoNum = Number(monto);
  const baseValida = baseNcProveedor(subtotal) !== null;
  const conversion = useNcProveedorTipoCambio({ open, fecha, moneda, monedaFactura, tipoCambio });
  const cruceInvalido = esCruceNoConvertible(moneda, monedaFactura);
  const montoEnFactura = montoNcEnMonedaFactura(montoNum, moneda, monedaFactura, conversion.tipoCambio);
  const excede = montoEnFactura !== null && montoEnFactura > saldoFactura + 0.01;
  const valido = baseValida && origenNcValido(mode, parsedCfdi, facturaId, cfdiFiles.xml) && Boolean(folio.trim()) && Boolean(fecha) && Number.isFinite(montoNum) && montoNum > 0 && montoEnFactura !== null && !excede && conversion.disponible;
  const isDirty =
    [subtotal, folio, monto, descripcion].some((value) => value.trim() !== "") || parsedCfdi !== null;
  const reset = () => {
    setMode("manual");
    setFolio("");
    setFecha(format(new Date(), "yyyy-MM-dd"));
    setMonto("");
    setSubtotal("");
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
  const clearCfdi = () => {
    setParsedCfdi(null);
    setCfdiFiles({ xml: null, pdf: null });
    setUuidFiscal(null);
  };
  const handleCfdiParsed = (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => {
    if (!xmlNcVerificado(data, facturaId)) {
      clearCfdi();
      notifyError(undefined, { title: "No se pudo verificar el XML contra esta factura. Vuelve a procesarlo.", method: "NC_PROVEEDOR_IDENTIDAD" });
      return false;
    }
    const prefill = buildNcPrefillFromCfdi(data);
    setFolio(prefill.folio);
    setFecha(prefill.fecha);
    setMonto(prefill.monto);
    setSubtotal(prefill.subtotal);
    if (prefill.moneda) setMoneda(prefill.moneda);
    setTipoCambio(prefill.tipoCambio);
    setDescripcion(prefill.descripcion);
    setUuidFiscal(prefill.uuidFiscal);
    setParsedCfdi(data);
    setCfdiFiles({ xml: files.xml, pdf: files.pdf });
  };
  const onSubmit = async () => {
    if (!valido || crear.isPending) return;
    const payload = construirNcProveedorPayload({
      facturaId, folio, fecha, monto: montoNum, subtotal: Number(subtotal),
      moneda, monedaFactura, tipoCambio: conversion.tipoCambio,
      motivo, descripcion, uuidFiscal,
    });
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
      isDirty={isDirty}
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
        origen={{ mode, facturaId, onModeChange: (next) => { clearCfdi(); setMode(next); }, parsedCfdi, onCfdiParsed: handleCfdiParsed, onClearCfdi: clearCfdi }}
        datos={{
          folio, onFolioChange: setFolio,
          fecha, onFechaChange: setFecha,
          monto, onMontoChange: setMonto,
          subtotal, onSubtotalChange: setSubtotal,
          motivo, onMotivoChange: setMotivo,
          descripcion, onDescripcionChange: setDescripcion,
        }}
        divisa={{
          monedaFactura, saldoFactura,
          moneda, onMonedaChange: setMoneda,
          tipoCambio, onTipoCambioChange: setTipoCambio,
        }}
      />
      <NcProveedorAvisos
        cruceInvalido={cruceInvalido}
        moneda={moneda}
        monedaFactura={monedaFactura}
        montoEnFactura={montoEnFactura}
        excede={excede}
        conversion={conversion}
      />
    </FormDialogShell>
  );
}
