/**
 * Tabla de movimientos del Estado de Cuenta (formato statement contable).
 *
 * - Toolbar (filtros + búsqueda) integrada en la misma tarjeta, estilo Odoo.
 * - Movimientos agrupados por moneda, con subtotales por grupo.
 * - Saldo acumulado (running balance) por moneda en orden cronológico.
 * - Filas colapsables con pagos y notas de crédito anidados.
 */
import { useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import { EstadoCuentaTableHead } from "./EstadoCuentaTableHead";
import { EstadoCuentaGrupoMoneda } from "./EstadoCuentaGrupoMoneda";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  GrupoMoneda,
  OrdenEstadoCuenta,
  SortEstadoCuenta,
} from "../services/estadoCuentaAging";

interface Props {
  grupos: GrupoMoneda[];
  isLoading?: boolean;
  facturaHref: (facturaId: string) => string;
  sort: SortEstadoCuenta;
  onSort: (key: OrdenEstadoCuenta) => void;
  toolbar?: React.ReactNode;
  /** Filas ocultas por paginación progresiva. */
  restantes: number;
  onVerMas: () => void;
}

function Vacio() {
  return (
    <div className="py-16 text-center">
      <Inbox className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        Sin movimientos con los filtros seleccionados.
      </p>
    </div>
  );
}

export function EstadoCuentaTable({
  grupos,
  isLoading,
  facturaHref,
  sort,
  onSort,
  toolbar,
  restantes,
  onVerMas,
}: Props) {
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const vacio = !isLoading && grupos.length === 0;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {toolbar && <div className="border-b px-3 py-2">{toolbar}</div>}

      {vacio ? (
        <Vacio />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <EstadoCuentaTableHead sort={sort} onSort={onSort} />
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={11}>
                        <Skeleton className="h-6" />
                      </TableCell>
                    </TableRow>
                  ))
                : grupos.map((g) => (
                    <EstadoCuentaGrupoMoneda
                      key={g.moneda}
                      grupo={g}
                      mostrarEncabezado={grupos.length > 1}
                      expandidas={expandidas}
                      onToggle={toggle}
                      facturaHref={facturaHref}
                    />
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && restantes > 0 && (
        <div className="flex items-center justify-center gap-3 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {restantes} movimiento(s) más
          </span>
          <Button variant="outline" size="sm" onClick={onVerMas}>
            Mostrar más
          </Button>
        </div>
      )}
    </div>
  );
}
