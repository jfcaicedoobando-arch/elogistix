/**
 * Fila de la bitácora de tesorería (presentación pura).
 */
import { Banknote, Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTimeShort } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Detalles = Record<string, unknown>;

function num(d: Detalles, k: string): number | null {
  const v = d[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(d: Detalles, k: string): string | null {
  const v = d[k];
  return typeof v === "string" && v !== "" ? v : null;
}

function EtiquetaMovimiento({ estado }: { estado: string | null }) {
  if (estado === "creado") {
    return <Badge variant="outline" className="text-success border-success/40">Movimiento creado</Badge>;
  }
  if (estado === "dado_de_baja") {
    return <Badge variant="outline" className="text-muted-foreground">Movimiento dado de baja</Badge>;
  }
  if (estado === "no_creado") {
    return (
      <Badge variant="outline" className="text-destructive border-destructive/40">
        <AlertTriangle className="h-3 w-3 mr-1" aria-hidden /> Movimiento no generado
      </Badge>
    );
  }
  if (estado === "sin_cuenta") {
    return <Badge variant="outline" className="text-warning border-warning/40">Sin cuenta bancaria</Badge>;
  }
  return null;
}

interface FilaProps {
  accion: string;
  createdAt: string;
  usuarioEmail: string;
  detalles: Detalles;
  monedaFactura: string;
  nombreCuenta: Map<string, string>;
}

export function BitacoraTesoreriaFila({
  accion, createdAt, usuarioEmail, detalles, monedaFactura, nombreCuenta,
}: FilaProps) {
  const esBaja = accion === "eliminar_pago";
  const monto = num(detalles, "monto");
  const moneda = str(detalles, "moneda") ?? monedaFactura;
  const cargoMxn = num(detalles, "cargo_mxn");
  const cuentaId = str(detalles, "cuenta_bancaria_id");
  const Icon = esBaja ? Trash2 : Banknote;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <Icon
        className={cn("h-4 w-4 shrink-0", esBaja ? "text-destructive" : "text-success")}
        aria-hidden
      />
      <span className="text-sm font-medium">{esBaja ? "Pago eliminado" : "Pago registrado"}</span>
      {monto !== null && (
        <span className="text-sm tabular-nums">{formatCurrency(monto, moneda)}</span>
      )}
      {cargoMxn !== null && moneda !== "MXN" && (
        <span className="text-xs text-muted-foreground tabular-nums">
          Cargo {formatCurrency(cargoMxn, "MXN")}
        </span>
      )}
      {cuentaId && (
        <span className="text-xs text-muted-foreground">
          {nombreCuenta.get(cuentaId) ?? "Cuenta bancaria"}
        </span>
      )}
      <EtiquetaMovimiento estado={str(detalles, "movimiento_tesoreria")} />
      <span className="ml-auto text-xs text-muted-foreground">
        {formatDateTimeShort(createdAt)} · {usuarioEmail}
      </span>
    </li>
  );
}
