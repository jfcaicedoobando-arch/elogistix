import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Props {
  fechaLimite: Date | undefined;
  onChange: (d: Date | undefined) => void;
}

export function FechaLimitePicker({ fechaLimite, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Fecha límite (opcional)</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-xs h-9",
              !fechaLimite && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {fechaLimite
              ? format(fechaLimite, "dd/MM/yyyy", { locale: es })
              : "Sin fecha límite"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={fechaLimite}
            onSelect={onChange}
            initialFocus
            locale={es}
          />
          {fechaLimite && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => onChange(undefined)}
              >
                Quitar fecha
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
