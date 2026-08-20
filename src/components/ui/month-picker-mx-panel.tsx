/** Rejilla de meses del popover de `MonthPickerMx` (extraída por Power of 10). */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MESES_ES_SHORT } from "./month-picker-mx-valor";

interface Props {
  /** `YYYY-MM` seleccionado (o vacío). */
  value: string;
  onSelect: (ym: string) => void;
}

export function MonthPickerMxPanel({ value, onSelect }: Props) {
  const parsed = /^\d{4}-\d{2}$/.test(value)
    ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) }
    : null;
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? new Date().getFullYear());

  useEffect(() => {
    if (parsed?.year) setViewYear(parsed.year);
  }, [parsed?.year]);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => setViewYear((y) => y - 1)} aria-label="Año anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-body font-medium">{viewYear}</div>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => setViewYear((y) => y + 1)} aria-label="Año siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MESES_ES_SHORT.map((label, idx) => (
          <Button
            key={label}
            variant={parsed?.year === viewYear && parsed?.month === idx + 1 ? "default" : "ghost"}
            size="sm"
            className="h-8 text-body-sm"
            onClick={() => onSelect(`${viewYear}-${String(idx + 1).padStart(2, "0")}`)}
          >
            {label}
          </Button>
        ))}
      </div>
    </>
  );
}
