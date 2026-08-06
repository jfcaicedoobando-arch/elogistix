/**
 * Grid de datos fiscales para `DialogNuevaFacturaManual`.
 * Extraído para mantener el dialog principal < 200 LOC.
 *
 * v13.312.27 (QW5 Tanda 2):
 * - Se agrega EUR como moneda soportada (multi-moneda manual).
 * - Botón "Traer TC DOF" al lado del input `tipo_cambio`, sólo visible cuando
 *   `moneda ∈ {USD, EUR}`. Reutiliza `useBanxicoTipoCambio`, que ya conoce
 *   ambas series (SF43718 para USD, SF46410 para EUR).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2 } from "lucide-react";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import { useBanxicoTipoCambio } from "@/features/facturacion/hooks/useBanxicoTipoCambio";

export type MonedaManual = "MXN" | "USD" | "EUR";

export interface DatosFiscalesValue {
  serie: string;
  fechaEmision: string;
  diasCredito: number;
  moneda: MonedaManual;
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  tipoCambio: number;
}

interface Props {
  value: DatosFiscalesValue;
  onChange: (patch: Partial<DatosFiscalesValue>) => void;
  /** Cuando true, los días de crédito se muestran readonly (source of truth = perfil del cliente). */
  diasReadonly?: boolean;
  diasReadonlyReason?: string;
}

export function FacturaManualDatosFiscales({ value, onChange, diasReadonly, diasReadonlyReason }: Props) {
  const traerTc = useBanxicoTipoCambio(value.moneda, (tc) => {
    if (tc && tc > 0) onChange({ tipoCambio: tc });
  });
  const requiereTc = value.moneda !== "MXN";
  const monedas: MonedaManual[] = ["MXN", "USD", "EUR"];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label>Días crédito</Label>
        <Input
          type="number" min={0} max={365} value={value.diasCredito}
          onChange={(e) => onChange({ diasCredito: Math.max(0, Number(e.target.value) || 0) })}
          readOnly={diasReadonly}
          disabled={diasReadonly}
          title={diasReadonly ? diasReadonlyReason : undefined}
          
        />
        {diasReadonly && diasReadonlyReason && (
          <p className="text-label text-muted-foreground">{diasReadonlyReason}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Moneda</Label>
        <div className="flex gap-1.5 flex-wrap">
          {monedas.map((m) => {
            const active = value.moneda === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ moneda: m })}
                className={
                  "h-11 md:h-10 px-3 rounded-md text-xs font-semibold border transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted")
                }
                aria-pressed={active}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Uso CFDI</Label>
        <Select value={value.usoCfdi} onValueChange={(v) => onChange({ usoCfdi: v })}>
          <SelectTrigger ><SelectValue /></SelectTrigger>
          <SelectContent>
            {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Forma de pago</Label>
        <Select value={value.formaPago} onValueChange={(v) => onChange({ formaPago: v })}>
          <SelectTrigger ><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Método de pago</Label>
        <Select value={value.metodoPago} onValueChange={(v) => onChange({ metodoPago: v })}>
          <SelectTrigger ><SelectValue /></SelectTrigger>
          <SelectContent>
            {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Tipo de cambio</Label>
        <div className="flex gap-1">
          <Input
            type="number" step="0.0001" min={0.0001}
            value={value.tipoCambio}
            onChange={(e) => onChange({ tipoCambio: Number(e.target.value) || 1 })}
            disabled={!requiereTc}
            className="text-right"
          />
          {requiereTc && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 px-2"
              onClick={() => traerTc.mutate()}
              disabled={traerTc.isPending}
              title={`Traer TC DOF Banxico (${value.moneda}/MXN)`}
            >
              {traerTc.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCcw className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
