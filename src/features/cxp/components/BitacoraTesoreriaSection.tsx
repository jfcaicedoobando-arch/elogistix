/**
 * R6-N2 — Bitácora de tesorería de una factura de proveedor.
 *
 * Muestra, en lenguaje de negocio, cada movimiento de tesorería generado al
 * registrar o eliminar un pago: quién lo hizo, cuándo, monto, cuenta bancaria
 * y si el movimiento bancario quedó creado o dado de baja.
 */
import { useMemo } from "react";
import { Banknote, Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { useBitacora } from "@/features/auditoria/hooks/useBitacora";
import { useCuentasBancarias } from "@/features/tesoreria";
import { formatCurrency, formatDateTimeShort } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const ACCIONES = ["pagar", "eliminar_pago"] as const;

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

interface Props {
  facturaId: string;
  monedaFactura: string;
}

export function BitacoraTesoreriaSection({ facturaId, monedaFactura }: Props) {
  const { data, isLoading } = useBitacora({
    entidadId: facturaId,
    acciones: [...ACCIONES],
    limite: 50,
  });
  const { data: cuentas = [] } = useCuentasBancarias(false);

  const nombreCuenta = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of cuentas) mapa.set(c.id, `${c.banco} · ${c.alias ?? "Cuenta"} (${c.moneda})`);
    return mapa;
  }, [cuentas]);

  const entradas = data?.datos ?? [];

  if (isLoading) return <ListSkeleton rows={3} />;

  return (
    <section className="space-y-3">
      <header className="space-y-0.5">
        <h3 className="text-sm font-semibold">Bitácora de tesorería</h3>
        <p className="text-xs text-muted-foreground">
          Movimientos bancarios generados al registrar o eliminar pagos de esta factura.
        </p>
      </header>

      {entradas.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center">
          Aún no hay movimientos de tesorería para esta factura.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {entradas.map((e) => {
            const d = (e.detalles ?? {}) as Detalles;
            const esBaja = e.accion === "eliminar_pago";
            const monto = num(d, "monto");
            const moneda = str(d, "moneda") ?? monedaFactura;
            const cargoMxn = num(d, "cargo_mxn");
            const cuentaId = str(d, "cuenta_bancaria_id");
            const Icon = esBaja ? Trash2 : Banknote;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                <Icon
                  className={cn("h-4 w-4 shrink-0", esBaja ? "text-destructive" : "text-success")}
                  aria-hidden
                />
                <span className="text-sm font-medium">
                  {esBaja ? "Pago eliminado" : "Pago registrado"}
                </span>
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
                <EtiquetaMovimiento estado={str(d, "movimiento_tesoreria")} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTimeShort(e.created_at)} · {e.usuario_email}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
