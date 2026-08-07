/**
 * Tarjeta de cuenta bancaria del listado de Tesorería › Cuentas.
 * Extraída de `TesoreriaCuentas` para respetar el límite Power-of-10 (≤200 líneas).
 */
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ROUTES } from "@/constants/routes";

export interface CuentaBancariaCardProps {
  cuenta: {
    id: string;
    alias: string;
    banco: string;
    moneda: string;
    numero_cuenta: string | null;
    clabe: string | null;
    saldo_inicial: number | string;
    fecha_saldo_inicial: string;
    activa: boolean;
  };
  saldoActual?: number;
  canAdmin: boolean;
  onEliminar: (id: string, alias: string) => void;
}

export function CuentaBancariaCard({
  cuenta: c,
  saldoActual,
  canAdmin,
  onEliminar,
}: CuentaBancariaCardProps) {
  const navigate = useNavigate();
  const irAConciliacion = () =>
    navigate(`${ROUTES.TESORERIA_CONCILIACION}?cuenta=${c.id}`);

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Ver movimientos de la cuenta ${c.alias}, ${c.banco}`}
      className={`transition-shadow hover:shadow-raised focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer ${!c.activa ? "opacity-60" : ""}`}
      onClick={irAConciliacion}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          irAConciliacion();
        }
      }}
    >
      <CardContent className="p-4 space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{c.alias}</p>
            <p className="text-xs text-muted-foreground">{c.banco} · {c.moneda}</p>
          </div>
          {canAdmin && (
            <Button
              variant="ghost" size="icon"
              aria-label={`Eliminar cuenta ${c.alias}`}
              onClick={(e) => { e.stopPropagation(); onEliminar(c.id, c.alias); }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
        {c.numero_cuenta && <p className="text-xs">Cuenta: <span className="font-mono">{c.numero_cuenta}</span></p>}
        {c.clabe && <p className="text-xs">CLABE: <span className="font-mono">{c.clabe}</span></p>}
        {saldoActual !== undefined ? (
          <p className="text-sm pt-2">Saldo actual: <span className="tabular-nums font-medium">{formatCurrency(saldoActual, c.moneda)}</span></p>
        ) : (
          <p className="text-sm pt-2">Saldo inicial: <span className="tabular-nums font-medium">{formatCurrency(Number(c.saldo_inicial), c.moneda)}</span></p>
        )}
        <p className="text-label text-muted-foreground">
          Saldo inicial {formatCurrency(Number(c.saldo_inicial), c.moneda)} al{" "}
          {formatDate(c.fecha_saldo_inicial)}
        </p>
        {!c.activa && <p className="text-xs text-muted-foreground italic">Cuenta inactiva</p>}
        <div className="pt-2">
          <Button
            variant="link" size="sm" className="h-auto p-0 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${ROUTES.TESORERIA_ESTADO_CUENTA}?cuenta=${c.id}`);
            }}
          >
            Ver estado de cuenta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
