/**
 * Cuerpo de la tabla de TabVsReal (filas o estado vacío) y aviso de
 * gastos en moneda extranjera sin tipo de cambio.
 */
import { Card, CardContent } from "@/components/ui/card";
import { TableCell } from "@/components/ui/table";
import { DetailTableRow } from "@/components/shared/DetailTable";
import { Button } from "@/components/ui/button";
import { pluralizar } from "@/lib/format/pluralizar";
import { VsRealFila } from "./VsRealFila";
import type { ordenarFilas } from "./vsRealSort";

/** Aviso de gastos en moneda extranjera sin tipo de cambio (con concordancia es-MX). */
export function AvisoGastosSinTc({ count }: { count: number }) {
  const uno = count === 1;
  return (
    <Card className="border-warning/50">
      <CardContent className="p-3 text-sm text-warning">
        {pluralizar(count, "gasto")} en moneda extranjera {uno ? "no tiene" : "no tienen"} tipo de cambio
        capturado y {uno ? "quedó" : "quedaron"} fuera del real. Captura su tipo de cambio para que se{" "}
        {uno ? "refleje" : "reflejen"} aquí.
      </CardContent>
    </Card>
  );
}

/** Cuerpo de la tabla: filas o estado vacío según el filtro activo. */
export function VsRealCuerpo({
  filas, soloExcesos, onQuitarFiltro,
}: {
  filas: ReturnType<typeof ordenarFilas>;
  soloExcesos: boolean;
  onQuitarFiltro: () => void;
}) {
  if (filas.length > 0) {
    return (
      <>
        {filas.map((f, i) => (
          <VsRealFila key={f.categoria_id} fila={f} striped={i % 2 === 1} />
        ))}
      </>
    );
  }
  return (
    <DetailTableRow hoverable={false}>
      <TableCell colSpan={5} className="py-8 text-center">
        <p className="text-body-sm text-muted-foreground mb-3">
          {soloExcesos
            ? "Ninguna categoría excede el 110% este mes."
            : "No hay categorías de presupuesto capturadas para este periodo."}
        </p>
        {soloExcesos && (
          <Button variant="outline" size="sm" onClick={onQuitarFiltro}>
            Quitar filtro "Solo excesos"
          </Button>
        )}
      </TableCell>
    </DetailTableRow>
  );
}
