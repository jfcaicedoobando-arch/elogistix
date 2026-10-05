import { formatCurrency, formatNumber } from "@/lib/formatters";

function importeDeclarado(detalles: Record<string, unknown>) {
  const total = detalles.total;
  const esNumero = typeof total === "number" || (
    typeof total === "string" && total.length <= 64 && /^-?[0-9]+(\.[0-9]+)?$/.test(total)
  );
  const moneda = typeof detalles.moneda === "string" && ["MXN", "USD", "EUR"].includes(detalles.moneda)
    ? detalles.moneda : null;
  if (!esNumero || !Number.isFinite(Number(total))) return null;
  return moneda ? formatCurrency(Number(total), moneda)
    : `${formatNumber(Number(total), { decimals: 2 })} (moneda no registrada)`;
}

/** Un registro genérico conserva datos declarados, sin certificar una operación. */
export function DatosDeclaradosBitacora({ tipo, detalles }: { tipo: string; detalles: Record<string, unknown> }) {
  if (detalles?.procedencia_verificada !== false) return null;
  const importe = importeDeclarado(detalles);
  const motivo = tipo === "actividad" && detalles.accion_registrada === "rechazar_factura_proveedor"
    && typeof detalles.motivo_rechazo === "string" && detalles.motivo_rechazo.trim()
    ? detalles.motivo_rechazo : null;
  if (!importe && !motivo) return null;
  return (
    <>
      {importe && (
        <p className="text-body-sm text-muted-foreground mt-1">
          Importe declarado en bitácora: {importe}.
        </p>
      )}
      {motivo && (
        <p className="text-body-sm text-muted-foreground mt-1">
          Motivo declarado en bitácora: {motivo}
        </p>
      )}
    </>
  );
}
