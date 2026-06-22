/**
 * Dialog para registrar una nueva nota de crédito de proveedor contra una factura.
 */
import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  const valido = folio.trim() && fecha && montoNum > 0 && montoNum <= saldoFactura + 0.01;

  const reset = () => {
    setFolio(""); setFecha(format(new Date(), "yyyy-MM-dd")); setMonto("");
    setMotivo("Bonificacion"); setDescripcion("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar nota de crédito</DialogTitle>
          <DialogDescription>
            Saldo actual de la factura: <strong className="tabular-nums">{saldoFactura.toFixed(2)} {monedaFactura}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-folio">Folio NC *</Label>
              <Input id="nc-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="NC-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-fecha">Fecha *</Label>
              <Input id="nc-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-monto">Monto ({monedaFactura}) *</Label>
            <Input
              id="nc-monto" type="number" step="0.01" min="0.01" max={saldoFactura}
              value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00"
            />
            {montoNum > saldoFactura + 0.01 && (
              <p className="text-xs text-destructive">El monto excede el saldo de la factura.</p>
            )}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valido || crear.isPending}
            onClick={async () => {
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
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
