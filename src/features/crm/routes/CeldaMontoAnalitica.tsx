/**
 * Celda de monto de la analítica CRM.
 *
 * Accesibilidad (candado `no-title-nativo`): el importe exacto se muestra con
 * `Hint` (tooltip de Radix visible con hover y con foco) en lugar del atributo
 * `title` nativo, que no existe en táctil ni con teclado.
 */
import { TableCell } from "@/components/ui/table";
import { Hint } from "@/components/shared/Hint";
import { montoAnalitica } from "@/features/crm/routes/analiticaMonto";

interface Props {
  monto: number | null | undefined;
  moneda: string;
}

export function CeldaMontoAnalitica({ monto, moneda }: Props) {
  const { texto, titulo } = montoAnalitica(monto, moneda);
  return (
    <TableCell className="text-right tabular-nums whitespace-nowrap">
      <Hint label={titulo}>
        <span aria-label={titulo}>{texto}</span>
      </Hint>
    </TableCell>
  );
}
