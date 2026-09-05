/**
 * Importe de la analítica CRM con el valor exacto en tooltip.
 *
 * Accesibilidad (candado `no-title-nativo`): el importe completo se muestra con
 * `Hint` (tooltip de Radix visible con hover y con foco) en lugar del atributo
 * `title` nativo, que no existe en táctil ni con teclado.
 */
import { Hint } from "@/components/shared/Hint";
import { montoAnalitica } from "@/features/crm/routes/analiticaMonto";

interface Props {
  monto: number;
  moneda: string;
}

export function CeldaMontoAnalitica({ monto, moneda }: Props) {
  const { texto, titulo } = montoAnalitica(monto, moneda);
  return (
    <Hint label={titulo}>
      <span aria-label={titulo}>{texto}</span>
    </Hint>
  );
}
