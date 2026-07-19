/**
 * Toolbar compartido para navegar el periodo mensual en Profit.
 * Layout: ‹ chevron · Select con meses · chevron ›.
 * Homogeneiza el look entre Dashboard Ejecutivo, Estado de Resultados y
 * Proyección de Facturación.
 */
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { MesDisponible } from "@/features/profit/hooks/usePeriodoMesUrl";

interface Props {
  mesActual: MesDisponible;
  mesesDisponibles: MesDisponible[];
  onChange: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  puedeIrAtras: boolean;
  puedeIrAdelante: boolean;
  triggerClassName?: string;
}

export function PeriodoMensualToolbar({
  mesActual, mesesDisponibles, onChange, onPrev, onNext,
  puedeIrAtras, puedeIrAdelante, triggerClassName = "w-full sm:w-[220px] font-medium",
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Button
        variant="outline" size="icon" className="h-9 w-9"
        onClick={onPrev} disabled={!puedeIrAtras}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={mesActual.key} onValueChange={onChange}>
        <SelectTrigger className={triggerClassName}><SelectValue /></SelectTrigger>
        <SelectContent>
          {mesesDisponibles.slice().reverse().map((m) => (
            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline" size="icon" className="h-9 w-9"
        onClick={onNext} disabled={!puedeIrAdelante}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
