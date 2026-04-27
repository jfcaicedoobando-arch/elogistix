import { useMemo } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerMxProps {
  /** ISO date string YYYY-MM-DD (o vacío) */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
}

/**
 * DatePicker localizado para México (formato DD/MM/YYYY visible, valor ISO).
 * Reemplaza al `<input type="date">` nativo que muestra "mm/dd/yyyy".
 */
export function DatePickerMx({
  value, onChange, placeholder = "Seleccionar", className, title,
}: DatePickerMxProps) {
  const date = useMemo(() => {
    if (!value) return undefined;
    // value es YYYY-MM-DD; construir Date local sin TZ shift
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  }, [value]);

  const display = useMemo(() => {
    if (!date) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, [date]);

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
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) {
              onChange("");
              return;
            }
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            onChange(iso);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
