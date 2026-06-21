/**
 * DialogTimbrarRep — Diálogo para timbrar el Recibo Electrónico de Pago (REP)
 * de un pago aplicado a una factura PPD.
 * v13.91.0
 */
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTimbrarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import { buildChecksRep } from "@/features/facturacion/utils/validarDatosTimbradoRep";
import { useQuery } from "@tanstack/react-query";
import { fetchClienteFiscal, type ClienteFiscalRow } from "@/features/facturacion/services";

interface PagoMin {
  id: string;
  monto: number;
  moneda: string;
  tipo_cambio: number;
  forma_pago: string;
  fecha_pago: string;
}

interface FacturaMin {
  id: string;
  numero: string;
  cliente_id: string;
  uuid_fiscal: string | null;
  metodo_pago: string | null;
  rfc_cliente: string | null;
}

interface Props {
  pago: PagoMin | null;
  factura: FacturaMin | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogTimbrarRep({ pago, factura, open, onOpenChange }: Props) {
  const timbrar = useTimbrarRep(factura?.id);

  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: ["cliente_fiscal", factura?.cliente_id],
    enabled: !!factura?.cliente_id && open,
    queryFn: () => fetchClienteFiscal(factura!.cliente_id),
  });

  if (!pago || !factura) return null;

  const { checks, puedeTimbrar } = buildChecksRep({
    facturaUuid: factura.uuid_fiscal,
    facturaMetodoPago: factura.metodo_pago,
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    formaPago: pago.forma_pago,
    monto: Number(pago.monto),
    moneda: pago.moneda,
    tipoCambio: Number(pago.tipo_cambio),
  });

  const onConfirm = () => {
    timbrar.mutate(pago.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Timbrar REP — Factura {factura.numero}
          </DialogTitle>
          <DialogDescription>
            Emite el Recibo Electrónico de Pago (Complemento de Pagos) ante el SAT por este abono.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ul className="text-sm space-y-1">
            {checks.map((c, i) => (
              <li key={i} className={c.ok ? "text-emerald-700" : "text-destructive"}>
                {c.ok ? "✓" : "✗"} {c.label}
              </li>
            ))}
          </ul>

          {!puedeTimbrar && (
            <Alert variant="destructive">
              <AlertDescription>
                Completa los datos fiscales del pago y del cliente antes de timbrar el REP.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!puedeTimbrar || timbrar.isPending}>
            {timbrar.isPending ? "Timbrando…" : "Timbrar REP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
