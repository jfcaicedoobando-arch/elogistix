import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

export default function ReportesFiltros({ fechaDesde, fechaHasta, modo, onFechaDesdeChange, onFechaHastaChange, onModoChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Desde</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {format(fechaDesde, "dd MMM yyyy", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={fechaDesde} onSelect={(d) => d && onFechaDesdeChange(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Hasta</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {format(fechaHasta, "dd MMM yyyy", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={fechaHasta} onSelect={(d) => d && onFechaHastaChange(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Modo</label>
        <Select value={modo} onValueChange={onModoChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODOS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
