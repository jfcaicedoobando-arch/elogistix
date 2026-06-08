/**
 * Registrar pago a proveedor.
 * Helpers de método (SPEI/SWIFT) extraídos a pagoProveedorHelpers.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { useRegistrarPagoProveedor } from "@/hooks/cxp";
import type { FacturaCxP } from "@/services/cxp";
import type { Database } from "@/integrations/supabase/types";
import { metodosFor, defaultMetodo, referenciaHint } from "./pagoProveedorHelpers";
import { FormSection } from "./facturaFormPrimitives";

type Moneda = Database["public"]["Enums"]["moneda"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
}

export function DialogRegistrarPagoProveedor({ open, onOpenChange, factura }: Props) {
  const registrar = useRegistrarPagoProveedor();
  const today = new Date().toISOString().slice(0, 10);

  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [tc, setTc] = useState("");
  const [metodo, setMetodo] = useState<string>("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [diffMxn, setDiffMxn] = useState<string>("");

  useEffect(() => {
    if (!factura || !open) return;
    setFecha(today);
    setMonto(factura.saldo.toFixed(2));
    setMoneda(factura.moneda);
    setTc(factura.tipo_cambio_usd ? String(factura.tipo_cambio_usd) : "");
    setMetodo(defaultMetodo(factura.proveedor_origen));
    setReferencia("");
    setNotas("");
    setDiffMxn("");
  }, [factura, open, today]);

  const metodosDisponibles = useMemo(
    () => metodosFor(factura?.proveedor_origen ?? null),
    [factura?.proveedor_origen],
  );

  const montoNum = Number(monto) || 0;
  const saldoRestante = useMemo(
    () => Math.max(0, (factura?.saldo ?? 0) - montoNum),
    [factura, montoNum],
  );
  const esUsdPagadoEnMxn = factura?.moneda === "USD" && moneda === "MXN";
  const showTc = moneda !== "MXN";
  const excede = factura ? montoNum > factura.saldo + 0.01 : false;

  const submit = async () => {
    if (!factura) return;
    if (montoNum <= 0) return toast.error("El monto debe ser mayor a 0");
    if (excede) return toast.error("El monto excede el saldo pendiente");
    try {
      await registrar.mutateAsync({
        proveedor_factura_id: factura.id,
        fecha_pago: fecha,
        monto: montoNum,
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
      <DialogContent className={cn(dialogSize.lg, "max-h-[90vh] flex flex-col gap-0 p-0")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Registrar pago a proveedor</DialogTitle>
          <DialogDescription>
            {factura ? `Factura ${factura.folio_proveedor} — ${factura.proveedor_nombre}` : ""}
          </DialogDescription>
          {factura && (
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>Saldo: <strong className="text-foreground tabular-nums">
                {formatCurrency(factura.saldo, factura.moneda)}
              </strong></span>
              <span>Total: <strong className="text-foreground tabular-nums">
                {formatCurrency(factura.total, factura.moneda)}
              </strong></span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <FormSection title="Fecha y método">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha de pago</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={metodo} onValueChange={setMetodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {metodosDisponibles.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Monto">
            <div className={cn("grid grid-cols-1 gap-3", showTc ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                  value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
              <div className="space-y-1">
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
              {showTc && (
                <div className="space-y-1">
                  <Label>Tipo de cambio</Label>
                  <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                    value={tc} onChange={(e) => setTc(e.target.value)} />
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Saldo restante tras el pago</span>
              <span className={cn(
                "text-lg font-semibold tabular-nums",
                excede ? "text-destructive" : saldoRestante === 0 ? "text-success" : "text-foreground",
              )}>
                {factura ? formatCurrency(saldoRestante, factura.moneda) : "—"}
              </span>
            </div>
            {excede && <p className="text-xs text-destructive">El monto excede el saldo pendiente.</p>}
          </FormSection>

          {esUsdPagadoEnMxn && (
            <FormSection title="Diferencia cambiaria">
              <div className="space-y-1">
                <Label>Diferencia cambiaria MXN (opcional)</Label>
                <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                  value={diffMxn} onChange={(e) => setDiffMxn(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Captura la diferencia cambiaria entre el TC de la factura y el TC del pago.
                </p>
              </div>
            </FormSection>
          )}

          <FormSection title="Referencia y notas">
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)}
                placeholder={referenciaHint(metodo)} />
              <p className="text-[11px] text-muted-foreground">{referenciaHint(metodo)}</p>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                placeholder="Observaciones internas…" />
            </div>
          </FormSection>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={registrar.isPending || excede || montoNum <= 0}>
            {registrar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {registrar.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
