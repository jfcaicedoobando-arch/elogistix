/**
 * Modal para registrar un traspaso entre cuentas propias de banco.
 *
 * La operación genera atómicamente el cargo (origen), abono (destino) y
 * comisión opcional en `bbva_movimientos`, todos auto-conciliados.
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { useRegistrarTraspaso } from "@/features/tesoreria/hooks/useTraspasos";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatters";

type Cuenta = Tables<"cuentas_bancarias">;

const hoyIso = () => format(new Date(), "yyyy-MM-dd");


interface DialogTraspasoCuentasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: Cuenta[];
}

export function DialogTraspasoCuentas({ open, onOpenChange, cuentas }: DialogTraspasoCuentasProps) {
  const [origenId, setOrigenId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(todayIso());
  const [montoOrigen, setMontoOrigen] = useState<number>(0);
  const [tipoCambio, setTipoCambio] = useState<number>(1);
  const [comision, setComision] = useState<number>(0);
  const [concepto, setConcepto] = useState<string>("");
  const [referencia, setReferencia] = useState<string>("");

  const { mutate: registrar, isPending } = useRegistrarTraspaso();

  useEffect(() => {
    if (!open) return;
    setOrigenId("");
    setDestinoId("");
    setFecha(todayIso());
    setMontoOrigen(0);
    setTipoCambio(1);
    setComision(0);
    setConcepto("");
    setReferencia("");
  }, [open]);

  const origen = useMemo(() => cuentas.find((c) => c.id === origenId), [cuentas, origenId]);
  const destino = useMemo(() => cuentas.find((c) => c.id === destinoId), [cuentas, destinoId]);
  const mismoMoneda = origen && destino && origen.moneda === destino.moneda;

  const montoDestino = useMemo(() => {
    if (!montoOrigen || montoOrigen <= 0) return 0;
    if (mismoMoneda) return montoOrigen;
    return montoOrigen * (tipoCambio || 1);
  }, [montoOrigen, mismoMoneda, tipoCambio]);

  const error = useMemo(() => {
    if (!origenId || !destinoId) return "Selecciona ambas cuentas.";
    if (origenId === destinoId) return "La cuenta origen y destino deben ser distintas.";
    if (!montoOrigen || montoOrigen <= 0) return "El monto debe ser mayor a cero.";
    if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
    if (!mismoMoneda && (!tipoCambio || tipoCambio <= 0)) {
      return "Captura el tipo de cambio para cuentas de distinta moneda.";
    }
    return null;
  }, [origenId, destinoId, montoOrigen, origen, destino, mismoMoneda, tipoCambio]);

  const handleSubmit = () => {
    if (error || isPending) return;
    registrar(
      {
        cuentaOrigenId: origenId,
        cuentaDestinoId: destinoId,
        fecha,
        montoOrigen,
        tipoCambio: mismoMoneda ? 1 : tipoCambio,
        comision,
        concepto: concepto.trim() || "Traspaso entre cuentas propias",
        referencia: referencia.trim(),
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ArrowRightLeft}
      title="Traspaso entre cuentas propias"
      description="Registra un movimiento entre tus cuentas del mismo tenant. Se generan los movimientos bancarios conciliados automáticamente."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!!error || isPending}>
            Registrar traspaso
          </Button>
        </>
      }
    >
      <FormDialogSection title="Cuentas" description="Selecciona la cuenta de origen y destino.">
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-origen">Cuenta origen</Label>
          <Select value={origenId} onValueChange={setOrigenId}>
            <SelectTrigger id="traspaso-origen">
              <SelectValue placeholder="Selecciona cuenta origen" />
            </SelectTrigger>
            <SelectContent>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.banco} {c.alias} ({c.moneda})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="traspaso-destino">Cuenta destino</Label>
          <Select value={destinoId} onValueChange={setDestinoId}>
            <SelectTrigger id="traspaso-destino">
              <SelectValue placeholder="Selecciona cuenta destino" />
            </SelectTrigger>
            <SelectContent>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.banco} {c.alias} ({c.moneda})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Importes y fecha">
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-fecha">Fecha</Label>
          <DatePickerMx id="traspaso-fecha" value={fecha} onChange={setFecha} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="traspaso-monto">Monto a transferir</Label>
          <MoneyInput
            id="traspaso-monto"
            value={montoOrigen}
            onChange={setMontoOrigen}
            currency={origen?.moneda}
          />
        </div>

        {!mismoMoneda && origen && destino && (
          <div className="space-y-1.5">
            <Label htmlFor="traspaso-tc">Tipo de cambio</Label>
            <MoneyInput
              id="traspaso-tc"
              value={tipoCambio}
              onChange={setTipoCambio}
              placeholder="1.00"
            />
            <p className="text-xs text-muted-foreground">
              {origen.moneda} → {destino.moneda}: {formatCurrency(montoDestino, destino.moneda)}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="traspaso-comision">Comisión bancaria (opcional)</Label>
          <MoneyInput
            id="traspaso-comision"
            value={comision}
            onChange={setComision}
            currency={origen?.moneda}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Detalles" cols={1}>
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-concepto">Concepto</Label>
          <Input
            id="traspaso-concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Traspaso entre cuentas propias"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-referencia">Referencia</Label>
          <Input
            id="traspaso-referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Referencia del banco"
          />
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
