import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/formatters/numbers";

/** Se captura base independiente del total: admite tasas mixtas y retenciones. */
export function BaseNcProveedorFields({ subtotal, monto, onChange }: {
  subtotal: string; monto: string; onChange: (value: string) => void;
}) {
  const valida = subtotal.trim() !== "" && Number.isFinite(Number(subtotal)) && Number(subtotal) >= 0;
  const totalValido = monto.trim() !== "" && Number.isFinite(Number(monto));
  return (
    <div className="space-y-1.5 mt-3">
      <Label htmlFor="nc-subtotal">Base sin impuestos *</Label>
      <Input id="nc-subtotal" type="number" min="0" step="0.01" value={subtotal}
        onChange={(event) => onChange(event.target.value)} placeholder="Base neta después de descuentos" />
      <p className="text-label text-muted-foreground">
        Monto es el total que reduce la deuda. Esta base revierte el gasto sin IVA/IEPS ni retenciones;
        captura el desglose de la NC, incluso si tiene tasas mixtas.
        {valida && totalValido && ` Impuestos netos (traslados menos retenciones): ${formatNumber(Number(monto) - Number(subtotal), { decimals: 2 })}.`}
      </p>
    </div>
  );
}
