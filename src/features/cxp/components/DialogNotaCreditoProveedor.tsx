/**
 * Registrar una nueva nota de crédito de proveedor contra una factura.
 * v13.305.11 · Soporta carga automática desde XML CFDI (nota de crédito
 * mexicana) además de la captura manual existente.
 */
import { useState } from "react";
import { format } from "date-fns";
import { FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { formatCurrency } from "@/lib/formatters";
import { useCrearNotaCredito } from "@/features/cxp/hooks/useNotasCreditoProveedor";
import { useOrgFilter } from "@/hooks/shared";
import { subirArchivosNcProveedor } from "@/features/cxp/services";
import { CargaXmlNcSection } from "./CargaXmlNcSection";
import { buildNcPrefillFromCfdi, type NcPrefillValues } from "./ncFromCfdi";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { CfdiParsedResponse } from "@/features/cxp/services";

type MotivoNC = Tables<"proveedor_notas_credito">["motivo"];
type MonedaNC = Tables<"proveedor_notas_credito">["moneda"];

type CargaMode = "manual" | "cfdi";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  monedaFactura: MonedaNC;
  saldoFactura: number;
}

const MOTIVOS: { value: MotivoNC; label: string }[] = [
  { value: "Devolucion", label: "Devolución" },
  { value: "Bonificacion", label: "Bonificación" },
  { value: "Descuento", label: "Descuento" },
  { value: "ErrorFacturacion", label: "Error de facturación" },
  { value: "Cancelacion", label: "Cancelación" },
  { value: "Otro", label: "Otro" },
];

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function DialogNotaCreditoProveedor({ open, onOpenChange, facturaId, monedaFactura, saldoFactura }: Props) {
  const [mode, setMode] = useState<CargaMode>("manual");
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState<MotivoNC>("Bonificacion");
  const [descripcion, setDescripcion] = useState("");
  const [parsedCfdi, setParsedCfdi] = useState<CfdiParsedResponse | null>(null);
  const [cfdiFiles, setCfdiFiles] = useState<{ xml: File | null; pdf: File | null }>({ xml: null, pdf: null });
  const [uuidFiscal, setUuidFiscal] = useState<string | null>(null);
  const crear = useCrearNotaCredito(facturaId);
  const { organizationId } = useOrgFilter();

  const montoNum = Number(monto);
  const excede = montoNum > saldoFactura + 0.01;
  const valido = folio.trim() && fecha && montoNum > 0 && !excede;
  const motivoLabel = MOTIVOS.find((m) => m.value === motivo)?.label ?? "—";

  const reset = () => {
    setMode("manual");
    setFolio("");
    setFecha(format(new Date(), "yyyy-MM-dd"));
    setMonto("");
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
      moneda: monedaFactura,
      motivo,
      descripcion,
      estado: "Borrador",
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
          notifyError(toast, {
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
      // eslint-disable-next-line no-console
      console.error("Error al registrar NC", err);
    }
  };

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

      <div className="rounded-lg border bg-muted/30">
        <div className="flex border-b">
          <TabButton active={mode === "manual"} onClick={() => setMode("manual")}>Captura manual</TabButton>
          <TabButton active={mode === "cfdi"} onClick={() => setMode("cfdi")}>Cargar XML CFDI</TabButton>
        </div>
        <div className="p-4">
          {mode === "cfdi" && (
            <CargaXmlNcSection parsed={parsedCfdi} onParsed={handleCfdiParsed} />
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-folio">Folio NC *</Label>
              <Input id="nc-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="NC-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-fecha">Fecha *</Label>
              <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            <Label htmlFor="nc-monto">Monto ({monedaFactura}) *</Label>
            <Input
              id="nc-monto" type="number" step="0.01" min="0.01" max={saldoFactura}
              value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5 mt-3">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoNC)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 mt-3">
            <Label htmlFor="nc-desc">Descripción</Label>
            <Textarea id="nc-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
          </div>
        </div>
      </div>

      {excede && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          El monto de la nota de crédito excede el saldo pendiente de la factura.
        </div>
      )}
    </FormDialogShell>
  );
}
