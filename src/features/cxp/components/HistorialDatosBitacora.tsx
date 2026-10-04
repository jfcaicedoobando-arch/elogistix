import { formatCurrency, formatNumber } from "@/lib/formatters";

/** Un registro genérico conserva datos declarados, sin certificar una operación. */
export function DatosDeclaradosBitacora({ detalles }: { detalles: Record<string, unknown> }) {
  if (detalles?.procedencia_verificada !== false) return null;
  const total = detalles.total;
  const esNumero = typeof total === "number" || (
    typeof total === "string" && total.length <= 64 && /^-?[0-9]+(\.[0-9]+)?$/.test(total)
  );
  if (!esNumero || !Number.isFinite(Number(total))) return null;
  const moneda = typeof detalles.moneda === "string" && ["MXN", "USD", "EUR"].includes(detalles.moneda)
    ? detalles.moneda : null;
  const importe = moneda
    ? formatCurrency(Number(total), moneda)
    : `${formatNumber(Number(total), { decimals: 2 })} (moneda no registrada)`;
  return (
    <p className="text-body-sm text-muted-foreground mt-1">
      Importe declarado en bitácora: {importe}.
    </p>
  );
}
