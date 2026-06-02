import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
import { ProveedorCombobox } from "./ProveedorCombobox";
import { useCrearFacturaProveedor } from "@/hooks/cxp";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DialogNuevaFacturaProveedor({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const crear = useCrearFacturaProveedor();
  const today = new Date().toISOString().slice(0, 10);

  const [provId, setProvId] = useState("");
  const [provNombre, setProvNombre] = useState("");
  const [folio, setFolio] = useState("");
  const [emision, setEmision] = useState(today);
  const [diasCredito, setDiasCredito] = useState(30);
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [tc, setTc] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [retenciones, setRetenciones] = useState(0);
  const [notas, setNotas] = useState("");

  const total = Number(subtotal) + Number(iva) - Number(retenciones);
  const venc = addDays(emision, Number(diasCredito) || 0);

  const reset = () => {
    setProvId(""); setProvNombre(""); setFolio(""); setEmision(today);
    setDiasCredito(30); setMoneda("MXN"); setTc(0);
    setSubtotal(0); setIva(0); setRetenciones(0); setNotas("");
  };

  const submit = async () => {
    if (!provId) return toast.error("Selecciona un proveedor");
    if (!folio.trim()) return toast.error("Captura el folio del proveedor");
    if (total <= 0) return toast.error("El total debe ser mayor a 0");
    try {
      await crear.mutateAsync({
        proveedor_id: provId,
        proveedor_nombre: provNombre,
        folio_proveedor: folio.trim(),
        fecha_emision: emision,
        fecha_vencimiento: venc,
        dias_credito: Number(diasCredito) || 0,
        moneda,
        tipo_cambio_usd: Number(tc) || 0,
        subtotal: Number(subtotal) || 0,
        iva: Number(iva) || 0,
        retenciones: Number(retenciones) || 0,
        total,
        estado: "Vigente",
        notas,
        created_by: user?.id,
      });
      toast.success("Factura de proveedor capturada");
      reset();
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Error al capturar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capturar factura de proveedor</DialogTitle>
          <DialogDescription>Registra la factura recibida para abrir su saldo en CxP.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Proveedor *</Label>
            <ProveedorCombobox value={provId} onChange={(id, n) => { setProvId(id); setProvNombre(n); }} className="w-full" />
          </div>
          <div>
            <Label>Folio del proveedor *</Label>
            <Input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="A-12345" />
          </div>
          <div>
            <Label>Fecha emisión</Label>
            <Input type="date" value={emision} onChange={(e) => setEmision(e.target.value)} />
          </div>
          <div>
            <Label>Días crédito</Label>
            <Input type="number" min={0} value={diasCredito} onChange={(e) => setDiasCredito(Number(e.target.value))} />
          </div>
          <div>
            <Label>Vencimiento</Label>
            <Input type="date" value={venc} readOnly className="bg-muted" />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as Moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de cambio USD</Label>
            <Input type="number" step="0.01" value={tc} onChange={(e) => setTc(Number(e.target.value))} />
          </div>
          <div>
            <Label>Subtotal</Label>
            <Input type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(Number(e.target.value))} />
          </div>
          <div>
            <Label>IVA</Label>
            <Input type="number" step="0.01" value={iva} onChange={(e) => setIva(Number(e.target.value))} />
          </div>
          <div>
            <Label>Retenciones</Label>
            <Input type="number" step="0.01" value={retenciones} onChange={(e) => setRetenciones(Number(e.target.value))} />
          </div>
          <div>
            <Label>Total</Label>
            <Input value={total.toFixed(2)} readOnly className="bg-muted font-semibold tabular-nums" />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={crear.isPending}>
            {crear.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
