import type { ReactNode } from "react";
import { TableRow, TableCell } from "@/components/ui/table";

/** Consistent subtotal/footer markup for DataTable's footer slot. */
export function DataTableTotalsRow({ label, labelSpan = 1, values }: {
  label: string;
  labelSpan?: number;
  values: ReactNode[];
}) {
  return (
    <TableRow className="hover:bg-transparent even:bg-transparent font-semibold">
      <TableCell colSpan={labelSpan} className="text-body-sm text-right">{label}</TableCell>
      {values.map((value, index) => <TableCell key={index} className="text-body-sm text-right tabular-nums">{value}</TableCell>)}
    </TableRow>
  );
}
