import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { formatCurrency } from "@/lib/formatters";
import { useExchangeRates } from "@/hooks/catalogos";
import { useRegistrarPagoFactura, usePagosFactura } from "@/hooks/facturacion";
import { useRegistrarActividad } from "@/hooks/shared/useBitacora";
import { useToast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: Factura | null;
}

const FORMAS = ["Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"];

function convertirAMonedaFactura(
  monto: number, monedaPago: string, monedaFactura: string,
  rates: { usdMxn: number; eurMxn: number } | undefined,
): number {
  if (monedaPago === monedaFactura) return monto;
  if (!rates || !rates.usdMxn) return monto;
  // Convertir todo a MXN primero
  const toMxn: Record<string, number> = { MXN: 1, USD: rates.usdMxn, EUR: rates.eurMxn };
  const enMxn = monto * (toMxn[monedaPago] ?? 1);
  const factorFactura = toMxn[monedaFactura] ?? 1;
  return enMxn / factorFactura;
}

export function DialogRegistrarPago({ open, onOpenChange, factura }: Props) {
  const { toast } = useToast();
  const { data: rates } = useExchangeRates();
  const { data: pagosPrevios = [] } = usePagosFactura(factura?.id);
  const registrar = useRegistrarPagoFactura();
  const registrarActividad = useRegistrarActividad();

  const totalPagado = useMemo(
    () => pagosPrevios.reduce((s, p) => s + Number(p.monto_aplicado_factura), 0),
    [pagosPrevios],
  );
  const saldo = useMemo(() => (factura ? factura.total - totalPagado : 0), [factura, totalPagado]);

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState<string>("");
  const [moneda, setMoneda] = useState<string>("MXN");
  const [formaPago, setFormaPago] = useState("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (open && factura) {
      setFecha(new Date().toISOString().slice(0, 10));
      setMonto(saldo > 0 ? saldo.toFixed(2) : "");
      setMoneda(factura.moneda);
      setFormaPago("Transferencia");
      setReferencia("");
      setNotas("");
    }
  }, [open, factura, saldo]);

  if (!factura) return null;

  const montoNum = Number(monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, moneda, factura.moneda, rates);
  const excede = montoAplicado > saldo + 0.01;
  const invalido = montoNum <= 0 || excede;
  const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;

  const handleGuardar = async () => {
    try {
      await registrar.mutateAsync({
        factura_id: factura.id,
        fecha_pago: fecha,
        monto: montoNum,
        moneda: moneda as "MXN" | "USD" | "EUR",
        tipo_cambio: tipoCambio,
        monto_aplicado_factura: montoAplicado,
        forma_pago: formaPago,
        referencia,
        notas,
      });
      registrarActividad.mutate({
        accion: "crear",
        modulo: "facturas",
        entidad_id: factura.id,
        entidad_nombre: `Pago ${formatCurrency(montoNum, moneda)} factura ${factura.numero}`,
      });
      notifySuccess(toast, { title: "Pago registrado" });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "Error al registrar pago",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>Registrar pago — Factura {factura.numero}</DialogTitle>
          <DialogDescription>
            Total: <strong>{formatCurrency(factura.total, factura.moneda)}</strong> · Pagado:{" "}
            <strong>{formatCurrency(totalPagado, factura.moneda)}</strong> · Saldo:{" "}
            <strong className={saldo > 0 ? "text-warning" : "text-success"}>
              {formatCurrency(saldo, factura.moneda)}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Fecha de pago</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Forma de pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto</Label>
            <Input
              type="number" step="0.01" min="0"
              value={monto} onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={setMoneda}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Folio SPEI, cheque..." />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>

        {moneda !== factura.moneda && montoNum > 0 && (
          <p className="text-xs text-muted-foreground">
            Equivalente: {formatCurrency(montoAplicado, factura.moneda)} (TC: {tipoCambio.toFixed(4)})
          </p>
        )}
        {excede && (
          <p className="text-xs text-destructive">
            El monto excede el saldo pendiente ({formatCurrency(saldo, factura.moneda)}).
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={invalido || registrar.isPending}>
            {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
