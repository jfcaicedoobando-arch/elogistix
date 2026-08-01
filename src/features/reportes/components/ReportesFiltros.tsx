import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
import { cn } from "@/lib/utils";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";

const MODOS = [
  { value: "all", label: "Todos los modos" },
  { value: "Marítimo", label: "Marítimo" },
  { value: "Aéreo", label: "Aéreo" },
  { value: "Terrestre", label: "Terrestre" },
  { value: "Multimodal", label: "Multimodal" },
];

interface Props {
  fechaDesde: Date;
  fechaHasta: Date;
  modo: string;
  onFechaDesdeChange: (d: Date) => void;
  onFechaHastaChange: (d: Date) => void;
  onModoChange: (m: string) => void;
}

function DateField({ label, value, onChange, fullWidth }: { label: string; value: Date; onChange: (d: Date) => void; fullWidth?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", fullWidth ? "w-full" : "w-[150px]")}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            {format(value, "dd MMM yyyy", { locale: es })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={(d) => d && onChange(d)} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ModoField({ value, onChange, fullWidth }: { value: string; onChange: (m: string) => void; fullWidth?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Modo</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("h-9", fullWidth ? "w-full" : "w-[180px]")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODOS.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ReportesFiltros({ fechaDesde, fechaHasta, modo, onFechaDesdeChange, onFechaHastaChange, onModoChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = modo !== "all" ? 1 : 0;

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden">
        <MobileFiltersSheet
          open={open}
          onOpenChange={setOpen}
          title="Filtros de reporte"
          activeCount={activeCount}
          onClearAll={() => onModoChange("all")}
          triggerLabel="Filtros de fecha y modo"
        >
          <DateField label={RANGO_DESDE_LABEL} value={fechaDesde} onChange={onFechaDesdeChange} fullWidth />
          <DateField label={RANGO_HASTA_LABEL} value={fechaHasta} onChange={onFechaHastaChange} fullWidth />
          <ModoField value={modo} onChange={onModoChange} fullWidth />
        </MobileFiltersSheet>
      </div>
      {/* Desktop */}
      <div className="hidden md:flex md:flex-wrap md:gap-3 md:items-end">
        <DateField label={RANGO_DESDE_LABEL} value={fechaDesde} onChange={onFechaDesdeChange} />
        <DateField label={RANGO_HASTA_LABEL} value={fechaHasta} onChange={onFechaHastaChange} />
        <ModoField value={modo} onChange={onModoChange} />
      </div>
    </>
  );
}
