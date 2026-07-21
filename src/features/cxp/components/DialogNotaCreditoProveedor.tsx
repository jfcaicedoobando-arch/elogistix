/**
 * Registrar una nueva nota de crédito de proveedor contra una factura.
 * v13.303.98 · Design language "Card grid estructurada": KPI grid superior
 * con Saldo (emphasis · warn), Moneda y Motivo seleccionado.
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
import type { Tables } from "@/integrations/supabase/types";

type MotivoNC = Tables<"proveedor_notas_credito">["motivo"];
type MonedaNC = Tables<"proveedor_notas_credito">["moneda"];

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

export function DialogNotaCreditoProveedor({ open, onOpenChange, facturaId, monedaFactura, saldoFactura }: Props) {
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState<MotivoNC>("Bonificacion");
  const [descripcion, setDescripcion] = useState("");
  const crear = useCrearNotaCredito(facturaId);

  const montoNum = Number(monto);
  const excede = montoNum > saldoFactura + 0.01;
  const valido = folio.trim() && fecha && montoNum > 0 && !excede;
  const motivoLabel = MOTIVOS.find((m) => m.value === motivo)?.label ?? "—";

  const reset = () => {
    setFolio(""); setFecha(format(new Date(), "yyyy-MM-dd")); setMonto("");
    setMotivo("Bonificacion"); setDescripcion("");
  };

  const handleOpenChange = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const onSubmit = async () => {
    await crear.mutateAsync({
      proveedor_factura_id: facturaId,
      folio_nc: folio.trim(),
      fecha,
      monto: montoNum,
      moneda: monedaFactura,
      motivo,
      descripcion,
      estado: "Borrador",
    });
    onOpenChange(false);
    reset();
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button disabled={!valido || crear.isPending} onClick={onSubmit}>Registrar</Button>
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

      {excede && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          El monto de la nota de crédito excede el saldo pendiente de la factura.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nc-folio">Folio NC *</Label>
          <Input id="nc-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="NC-001" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nc-fecha">Fecha *</Label>
          <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-monto">Monto ({monedaFactura}) *</Label>
        <Input
          id="nc-monto" type="number" step="0.01" min="0.01" max={saldoFactura}
          value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Motivo *</Label>
        <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoNC)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-desc">Descripción</Label>
        <Textarea id="nc-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
      </div>
    </FormDialogShell>
  );
}
