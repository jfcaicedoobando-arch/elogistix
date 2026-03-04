import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalUSD: number;
  totalMXN: number;
}

export default function ResumenTotalesCotizacion({ totalUSD, totalMXN }: Props) {
  return (
    <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
      <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
      <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
      <span className="text-xs text-muted-foreground">* Los conceptos en MXN incluyen IVA 16%</span>
    </div>
  );
}
