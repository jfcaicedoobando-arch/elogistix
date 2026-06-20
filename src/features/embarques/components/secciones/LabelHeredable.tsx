/**
 * Label que muestra un `HeredadoBadge` cuando el campo proviene
 * de la cotización vinculada (Pack B+ v13.33.0).
 */
import { useWatch, useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { HeredadoBadge } from "@/components/shared/HeredadoBadge";
import { useCotizacionVinculada } from "@/features/embarques/hooks/useCotizacionVinculada";
import type { EmbarqueFormValues } from "@/features/embarques/domain/mappers/embarque";
import type { CotizacionRow } from "@/features/cotizacion/hooks";

interface Props {
  /** Texto visible del label. */
  children: React.ReactNode;
  /** Campo del formulario de embarque. */
  field: keyof EmbarqueFormValues;
  /** Getter del valor original en la cotización. */
  getter: (cot: CotizacionRow) => unknown;
  /** id del input asociado (para `htmlFor` accesible). */
  htmlFor?: string;
  className?: string;
}

export function LabelHeredable({ children, field, getter, htmlFor, className }: Props) {
  const cot = useCotizacionVinculada();
  const { control } = useFormContext<EmbarqueFormValues>();
  // useWatch garantiza re-render cuando el usuario edita el campo,
  // para que el badge desaparezca en tiempo real.
  const current = useWatch({ control, name: field });

  let heredado = false;
  if (cot) {
    const original = getter(cot);
    const originalEmpty = original === null || original === undefined || original === "";
    const currentEmpty = current === null || current === undefined || current === "";
    heredado = !originalEmpty && !currentEmpty && String(current) === String(original);
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{children}</Label>
      {heredado && cot && <HeredadoBadge origen={cot.folio ?? ""} />}
    </div>
  );
}
