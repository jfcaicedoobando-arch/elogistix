import { useState } from "react";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTimbrarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
  type ClienteFiscalRow,
} from "@/features/facturacion/services";
import { useQuery } from "@tanstack/react-query";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";

interface Props {
  facturaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type FiscalCliente = ClienteFiscalRow;

export function DialogTimbrarFactura({ facturaId, open, onOpenChange }: Props) {
  const timbrar = useTimbrarFactura();
  const { data: factura } = useFactura(facturaId ?? undefined);

  const { data: cliente } = useQuery<FiscalCliente | null>({
    queryKey: ["cliente_fiscal", factura?.cliente_id],
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchClienteFiscal(factura!.cliente_id),
  });

  const [serie, setSerie] = useState("A");
  const [usoCfdi, setUsoCfdi] = useState(factura?.uso_cfdi ?? cliente?.uso_cfdi_default ?? "G03");
  const [formaPago, setFormaPago] = useState(factura?.forma_pago ?? "03");
  const [metodoPago, setMetodoPago] = useState(factura?.metodo_pago ?? "PUE");

  if (!facturaId || !factura) return null;

  const rfc = cliente?.rfc ?? factura.rfc_cliente ?? "";
  const cp = cliente?.codigo_postal ?? "";
  const regimen = cliente?.regimen_fiscal ?? "";

  const checks = [
    { ok: !!rfc && rfc.length >= 12, label: `RFC del cliente: ${rfc || "FALTA"}` },
    { ok: !!cp && /^\d{5}$/.test(cp), label: `Código postal: ${cp || "FALTA"}` },
    { ok: !!regimen, label: `Régimen fiscal: ${regimen || "FALTA"}` },
    { ok: !!usoCfdi, label: `Uso CFDI: ${usoCfdi}` },
    { ok: !!formaPago, label: `Forma de pago SAT: ${formaPago}` },
    { ok: !!metodoPago, label: `Método de pago SAT: ${metodoPago}` },
  ];
  const puedeTimbrar = checks.every((c) => c.ok);

  const onConfirm = async () => {
    // Persiste la elección antes de timbrar
    await supabase.from("facturas").update({
      serie, uso_cfdi: usoCfdi, forma_pago: formaPago, metodo_pago: metodoPago,
    }).eq("id", facturaId);

    timbrar.mutate(facturaId, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stamp className="h-5 w-5" /> Timbrar factura {factura.numero}
          </DialogTitle>
          <DialogDescription>
            Revisa los datos fiscales antes de emitir el CFDI 4.0 a través de Facturapi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="text-sm space-y-1">
            {checks.map((c, i) => (
              <li key={i} className={c.ok ? "text-emerald-700" : "text-destructive"}>
                {c.ok ? "✓" : "✗"} {c.label}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Serie</Label>
              <Input value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase().slice(0, 5))} maxLength={5} />
            </div>
            <div>
              <Label>Uso CFDI</Label>
              <Select value={usoCfdi} onValueChange={setUsoCfdi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pago</Label>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!puedeTimbrar && (
            <Alert variant="destructive">
              <AlertDescription>
                Completa los datos fiscales del cliente antes de timbrar.
                Puedes hacerlo en el detalle del cliente.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!puedeTimbrar || timbrar.isPending}>
            {timbrar.isPending ? "Timbrando…" : "Timbrar ahora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
