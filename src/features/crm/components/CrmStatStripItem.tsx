/**
 * Ítem canónico de la tira de KPIs del CRM.
 * Extraído de /crm para respetar el límite de tamaño de archivo (Power-of-10 #4).
 */
import type { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/shared/Hint";

export function CrmStatStripItem({
  icon: Icon,
  label,
  value,
  valueTooltip,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  /** Valor completo cuando `value` viene en notación compacta (MXN 304.4K). */
  valueTooltip?: string;
}) {
  return (
    <Card className="flex items-center gap-3 px-4 h-14 rounded-md sm:rounded-none sm:border-0 sm:border-r last:sm:border-r-0 sm:shadow-none">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-label text-muted-foreground truncate">{label}</div>
        <Hint label={valueTooltip}>
          <div className="text-base font-semibold tabular-nums truncate">
            {value}
          </div>
        </Hint>
      </div>
    </Card>
  );
}

export default CrmStatStripItem;
