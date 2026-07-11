import { useMemo } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerMxProps {
  /** Valor tipo `datetime-local`: `YYYY-MM-DDTHH:mm` (o vacío). */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
}

/**
 * DateTime picker localizado para México (DD/MM/YYYY HH:mm).
 * Reemplaza al `<input type="datetime-local">` nativo.
 */
export function DateTimePickerMx({
  value, onChange, placeholder = "Seleccionar", className, title,
}: DateTimePickerMxProps) {
  const { date, time } = useMemo(() => {
    if (!value) return { date: undefined as Date | undefined, time: "" };
    const [datePart, timePart = ""] = value.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return { date: undefined, time: "" };
    return { date: new Date(y, m - 1, d), time: timePart.slice(0, 5) };
  }, [value]);

  const display = useMemo(() => {
    if (!date) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}${time ? ` ${time}` : ""}`;
  }, [date, time]);

  const emit = (d: Date | undefined, t: string) => {
    if (!d) {
      onChange("");
      return;
    }
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    onChange(`${iso}T${t || "09:00"}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          title={title}
          className={cn(
            "justify-start text-left font-normal h-10 px-3",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{display || placeholder}</span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange("");
              }}
              className="ml-auto rounded p-0.5 hover:bg-muted text-muted-foreground"
              aria-label="Limpiar fecha"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => emit(d ?? undefined, time)}
          autoFocus
          locale={es}
        />

        <div className="border-t p-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Hora</span>
          <Input
            type="time"
            value={time || "09:00"}
            onChange={(e) => emit(date, e.target.value)}
            className="h-9 w-32"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
