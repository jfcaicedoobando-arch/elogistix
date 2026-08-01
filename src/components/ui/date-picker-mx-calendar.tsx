import { Calendar as CalendarIcon } from "lucide-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { pickerIconClass } from "@/components/ui/picker-mx-shell";
import { dateToIso, isoToDate, isoToDisplay } from "./date-picker-mx-helpers";

interface Props {
  value: string;
  min?: string;
  max?: string;
  open: boolean;
  disabled?: boolean;
  setOpen: (o: boolean) => void;
  onPick: (iso: string) => void;
  onClear: () => void;
}

/** Botón + popover con Calendar embebido, extraído para respetar el
 *  límite Power-of-10 (≤200 líneas por archivo). */
export function DatePickerMxCalendar({
  value, min, max, open, disabled, setOpen, onPick, onClear,
}: Props) {
  const selectedDate = isoToDate(value);
  const minDate = min ? isoToDate(min) : undefined;
  const maxDate = max ? isoToDate(max) : undefined;
  const dayDisabled: Array<{ before: Date } | { after: Date }> = [];
  if (minDate) dayDisabled.push({ before: minDate });
  if (maxDate) dayDisabled.push({ after: maxDate });

  return (
    <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Abrir calendario"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <CalendarIcon className={pickerIconClass} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate ?? maxDate ?? minDate}
          disabled={dayDisabled.length ? dayDisabled : undefined}
          onSelect={(d) => {
            if (!d) onClear();
            else onPick(dateToIso(d));
            setOpen(false);
          }}
          autoFocus
          locale={es}
          captionLayout="dropdown"
          startMonth={new Date(1900, 0)}
          endMonth={new Date(2100, 11)}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export { isoToDisplay };
