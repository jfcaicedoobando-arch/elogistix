import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { useRegistrarPagoProveedor } from "@/hooks/cxp";
import type { FacturaCxP } from "@/services/cxp";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
}

const METODOS = ["Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"] as const;

export function DialogRegistrarPagoProveedor({ open, onOpenChange, factura }: Props) {
  const registrar = useRegistrarPagoProveedor();
  const today = new Date().toISOString().slice(0, 10);

  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState(0);
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [tc, setTc] = useState(0);
  const [metodo, setMetodo] = useState<string>("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [diffMxn, setDiffMxn] = useState<number | "">("");

  useEffect(() => {
    if (!factura) return;
    setMonto(factura.saldo);
    setMoneda(factura.moneda);
    setTc(factura.tipo_cambio_usd);
    setDiffMxn("");
  }, [factura]);

  const esUsdPagadoEnMxn = factura?.moneda === "USD" && moneda === "MXN";

  const submit = async () => {
    if (!factura) return;
    if (monto <= 0) return toast.error("El monto debe ser mayor a 0");
    try {
      await registrar.mutateAsync({
        proveedor_factura_id: factura.id,
        fecha_pago: fecha,
        monto: Number(monto),
        moneda,
        tipo_cambio_usd: Number(tc) || 0,
        metodo_pago: metodo,
        referencia,
        notas,
        diferencia_cambiaria_mxn: esUsdPagadoEnMxn && diffMxn !== "" ? Number(diffMxn) : null,
      });
      toast.success("Pago registrado");
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Error al registrar pago");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar pago a proveedor</DialogTitle>
          <DialogDescription>
            {factura ? `Factura ${factura.folio_proveedor} — ${factura.proveedor_nombre} — Saldo: ${factura.saldo.toFixed(2)} ${factura.moneda}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha de pago</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>Método</Label>
            <Select value={metodo} onValueChange={setMetodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(Number(e.target.value))} />
          </div>
          <div>
            <Label>Moneda pago</Label>
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
            <Label>Tipo de cambio del día</Label>
            <Input type="number" step="0.01" value={tc} onChange={(e) => setTc(Number(e.target.value))} />
          </div>
          {esUsdPagadoEnMxn && (
            <div>
              <Label>Diferencia cambiaria MXN</Label>
              <Input
                type="number" step="0.01"
                value={diffMxn}
                onChange={(e) => setDiffMxn(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Opcional"
              />
            </div>
          )}
          <div className="col-span-2">
            <Label>Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Folio bancario, cheque..." />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={registrar.isPending}>
            {registrar.isPending ? "Guardando..." : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
