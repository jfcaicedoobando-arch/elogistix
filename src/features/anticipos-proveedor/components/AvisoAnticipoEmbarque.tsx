/**
 * Aviso (no bloqueante) al capturar la factura de un proveedor: si el embarque
 * al que se está vinculando ya tiene anticipos con saldo a favor de ese mismo
 * proveedor, se muestra aquí para que el contador haga el cruce después.
 */
import { HandCoins } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { useAnticiposDisponiblesPorEmbarque } from "@/features/anticipos-proveedor/hooks/useAnticiposDisponiblesPorEmbarque";

interface Props {
  proveedorId?: string | null;
  embarqueId?: string | null;
  expediente?: string | null;
}

export function AvisoAnticipoEmbarque({ proveedorId, embarqueId, expediente }: Props) {
  const { anticipos, porMoneda } = useAnticiposDisponiblesPorEmbarque(proveedorId, embarqueId);

  if (anticipos.length === 0) return null;

  const resumen = porMoneda.map((m) => formatCurrency(m.disponible, m.moneda)).join(" · ");
  const ref = expediente?.trim() || "este embarque";

  return (
    <Alert>
      <HandCoins className="h-4 w-4" />
      <AlertTitle>
        {anticipos.length === 1 ? "Hay 1 anticipo" : `Hay ${anticipos.length} anticipos`} a este
        proveedor en {ref}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p className="text-xs">
          Saldo por aplicar: <span className="font-medium tabular-nums">{resumen}</span>. Al guardar
          la factura podrás aplicarlo desde su detalle (no se aplica automáticamente).
        </p>
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {anticipos.map((a) => (
            <li key={a.id} className="tabular-nums">
              {formatDate(a.fecha_anticipo)} · {formatCurrency(a.disponible, a.moneda)} disponibles
              {a.referencia ? ` · Ref. ${a.referencia}` : ""}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
