/**
 * Tabla simple compartida por las bandejas nuevas del cockpit de
 * Facturación (Por timbrar, Por enviar, REP pendientes).
 *
 * Renderiza una tabla ligera con la última columna reservada para la
 * acción rápida. Estados de carga / vacío gestionados aquí para
 * mantener las bandejas ≤200 líneas.
 */
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export interface ColumnaBandeja<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columnas: ColumnaBandeja<T>[];
  data: T[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  rowKey: (row: T) => string;
  accion?: {
    label: string;
    onClick: (row: T) => void;
    icon?: ReactNode;
  };
}

export function TablaBandejaSimple<T>({
  columnas, data, isLoading, emptyMessage, rowKey, accion,
}: Props<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columnas.map((c) => (
              <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
            ))}
            {accion && <TableHead className="w-[140px] text-right">Acción</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)}>
              {columnas.map((c) => (
                <TableCell key={c.key} className={c.className}>{c.cell(r)}</TableCell>
              ))}
              {accion && (
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => accion.onClick(r)}>
                    {accion.icon}
                    {accion.label}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
