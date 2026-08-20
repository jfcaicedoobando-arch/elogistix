/**
 * Cascarón compartido de las tablas de reparto en lote (UX-12).
 *
 * CxP ("Pago en lote a proveedor") y Facturación ("Cobro en lote de cliente")
 * tenían dos tablas casi idénticas que ya empezaban a divergir. Aquí vive una
 * sola vez el contenedor, el `<TableHeader>` y la tipografía de encabezados del
 * design system; cada diálogo aporta sus propios renglones como `children`.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface LoteRenglonesTableProps {
  /** Ancho mínimo del scroll horizontal (varía entre CxP y CxC). */
  minWidthClassName?: string;
  children: ReactNode;
}

const COLUMNAS = [
  { label: "Factura", width: "w-[18%]", align: "text-left" },
  { label: "Vence", width: "w-[16%]", align: "text-left" },
  { label: "Saldo", width: "w-[18%]", align: "text-right" },
  { label: "Se aplica", width: "w-[26%]", align: "text-right" },
  { label: "Queda", width: "w-[22%]", align: "text-right" },
] as const;

export function LoteRenglonesTable({
  minWidthClassName = "min-w-[660px]",
  children,
}: LoteRenglonesTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className={cn("w-full text-body", minWidthClassName)}>
        <TableHeader className="bg-muted/50 text-table-head text-muted-foreground">
          <TableRow>
            {COLUMNAS.map((c) => (
              <DetailTableHead key={c.label} className={cn("px-3 py-2 font-medium", c.width, c.align)}>
                {c.label}
              </DetailTableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
