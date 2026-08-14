/**
 * Aplicar un anticipo desde el detalle de la factura de proveedor.
 * La factura es fija: sólo se elige el anticipo con saldo a favor y el monto.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { evaluarDesajusteEmbarque } from "@/features/anticipos-proveedor/domain/avisoEmbarqueAnticipo";
import {
  esMismoEmbarque,
  ordenarAnticiposPorEmbarque,
} from "@/features/anticipos-proveedor/domain/ordenAnticiposPorEmbarque";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { todayLocalISO } from "@/lib/date/today";
import { notifyError } from "@/lib/ui/appFeedback";
import { useAplicarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";
import { parseMonto } from "@/lib/format/parseMonto";
import {
  AplicarAnticipoResumen,
  type ImportesFactura,
} from "@/features/anticipos-proveedor/components/AplicarAnticipoResumen";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  folioFactura: string;
  /** Desglose completo de importes de la factura (subtotal → saldo por pagar). */
  importes: ImportesFactura;
  anticipos: AnticipoProveedorRow[];
  /** Embarque de la factura, para avisar si no coincide con el del anticipo. */
  facturaEmbarqueId?: string | null;
  facturaExpediente?: string | null;
}


export function AplicarAnticipoDesdeFacturaDialog({
  open, onOpenChange, facturaId, folioFactura, importes, anticipos,
  facturaEmbarqueId, facturaExpediente,
}: Props) {

  const saldoFactura = importes.saldo;
  const monedaFactura = importes.moneda;
  const aplicar = useAplicarAnticipo();
  // Los anticipos del mismo expediente se ofrecen primero (cruce natural).
  const anticiposOrdenados = useMemo(
    () => ordenarAnticiposPorEmbarque(anticipos, facturaEmbarqueId ?? null),
    [anticipos, facturaEmbarqueId],
  );
  const [anticipoId, setAnticipoId] = useState("");
  const [monto, setMonto] = useState("0");
  const [fecha, setFecha] = useState(todayLocalISO());

  const anticipo = useMemo(
    () => anticiposOrdenados.find((a) => a.id === anticipoId) ?? null,
    [anticiposOrdenados, anticipoId],
  );

  // Al abrir (o cambiar de anticipo) sugiere el menor entre saldo a favor y saldo de factura.
  useEffect(() => {
    if (!open) return;
    if (!anticipoId && anticiposOrdenados.length > 0) {
      setAnticipoId(anticiposOrdenados[0].id);
      return;
    }
    if (anticipo) {
      const sugerido = Math.min(anticipo.disponible, saldoFactura);
      setMonto(sugerido > 0 ? sugerido.toFixed(2) : "0");
    }
  }, [open, anticipoId, anticipo, anticiposOrdenados, saldoFactura]);

  const handleOpenChange = (o: boolean) => {
    if (!o) { setAnticipoId(""); setMonto("0"); setFecha(todayLocalISO()); }
    onOpenChange(o);
  };

  // Ola 9 · B5: parseo centralizado de montos tecleados.
  const montoNum = parseMonto(monto, NaN);

  const monedaDifiere = Boolean(anticipo) && anticipo!.moneda !== monedaFactura;
  const desajuste = useMemo(
    () =>
      evaluarDesajusteEmbarque({
        anticipoEmbarqueId: anticipo?.embarque_id ?? null,
        anticipoExpediente: anticipo?.embarque_expediente ?? null,
        facturaEmbarqueId: facturaEmbarqueId ?? null,
        facturaExpediente: facturaExpediente ?? null,
      }),
    [anticipo, facturaEmbarqueId, facturaExpediente],
  );


  const onSubmit = async () => {
    if (!anticipo) return;
    if (!(montoNum > 0)) {
      notifyError(undefined, {
        title: "Monto inválido",
        description: "El monto a aplicar debe ser mayor a cero.",
        method: "ANTICIPO_APLICAR_FACTURA_MONTO",
      });
      return;
    }
    if (montoNum > anticipo.disponible + 0.01) {
      notifyError(undefined, {
        title: "Excede el saldo a favor",
        description: `El anticipo sólo tiene ${formatCurrency(anticipo.disponible, anticipo.moneda)} disponibles.`,
        method: "ANTICIPO_APLICAR_FACTURA_TOPE",
      });
      return;
    }
    await aplicar.mutateAsync({ anticipoId: anticipo.id, facturaId, monto: montoNum, fechaAplicacion: fecha });
    handleOpenChange(false);
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={aplicar.isPending}>Cancelar</Button>
      <Button onClick={onSubmit} disabled={!anticipoId} loading={aplicar.isPending}>
        {aplicar.isPending ? "Aplicando…" : "Aplicar anticipo"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={ArrowRightLeft}
      title="Aplicar anticipo a esta factura"
      description={`Factura ${folioFactura} · revisa el desglose antes de aplicar.`}
      size="lg"
      footer={footer}
    >
      <FormDialogSection title="Importes">
        <AplicarAnticipoResumen
          factura={importes}
          anticipo={anticipo}
          montoAplicar={Number.isFinite(montoNum) ? montoNum : 0}
        />
      </FormDialogSection>

      <FormDialogSection title="Anticipo a aplicar">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="apl-anticipo">Anticipo con saldo a favor</Label>
          <Select value={anticipoId} onValueChange={setAnticipoId}>
            <SelectTrigger id="apl-anticipo">
              <SelectValue placeholder="Selecciona un anticipo" />
            </SelectTrigger>
            <SelectContent>
              {anticiposOrdenados.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {formatDate(a.fecha_anticipo)} · {formatCurrency(a.disponible, a.moneda)} disponibles
                  {a.referencia ? ` · Ref. ${a.referencia}` : ""}
                  {esMismoEmbarque(a.embarque_id, facturaEmbarqueId ?? null)
                    ? " · Mismo expediente"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-fecha-f">Fecha de aplicación</Label>
          <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-monto-f">Monto a aplicar (sobre el saldo por pagar)</Label>
          <Input
            id="apl-monto-f"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        {desajuste.hayDesajuste && (
          <div className="md:col-span-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-foreground">{desajuste.mensaje}</p>
          </div>
        )}
      </FormDialogSection>

    </FormDialogShell>
  );
}
