/**
 * Label que muestra un `HeredadoBadge` cuando el campo proviene
 * de la cotización vinculada (Pack B+ v13.33.0).
 */
import { Label } from "@/components/ui/label";
import { HeredadoBadge } from "@/components/shared/HeredadoBadge";
import {
  useCotizacionVinculada,
  useHeredadoCotizacion,
} from "@/features/embarques/hooks/useHeredadoCotizacion";
import type { EmbarqueFormValues } from "@/lib/mappers/embarque";
import type { CotizacionRow } from "@/features/cotizacion/hooks";

interface Props {
  /** Texto visible del label. */
  children: React.ReactNode;
  /** Campo del formulario de embarque. */
  field: keyof EmbarqueFormValues;
  /** Getter del valor original en la cotización. */
  getter: (cot: CotizacionRow) => unknown;
  className?: string;
}

export function LabelHeredable({ children, field, getter, className }: Props) {
  const cot = useCotizacionVinculada();
  const isHeredado = useHeredadoCotizacion();
  const heredado = isHeredado(field, getter);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Label>{children}</Label>
      {heredado && cot && <HeredadoBadge origen={cot.folio ?? ""} />}
    </div>
  );
}
