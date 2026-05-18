import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInCalendarDays } from "date-fns";
import { formatDate } from "@/lib/formatters";

export function FechaConOriginal({ actual, original }: { actual: string | null; original: string | null | undefined }) {
  if (!actual && !original) return <>-</>;
  const actualLabel = actual ? formatDate(actual) : "-";
  if (!original || !actual || original === actual) {
    return <>{actualLabel}</>;
  }
  const diff = differenceInCalendarDays(new Date(actual + "T00:00:00"), new Date(original + "T00:00:00"));
  const signo = diff > 0 ? `+${diff}d` : `${diff}d`;
  const tono = diff > 0
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-emerald-100 text-emerald-800 border-emerald-200";
  return (
    <span className="inline-flex items-center gap-2">
      <span>{actualLabel}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] font-normal ${tono}`}>
            Original: {formatDate(original)} ({signo})
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Fecha cotizada al cliente. La fecha actual difiere {signo} respecto a la original.</TooltipContent>
      </Tooltip>
    </span>
  );
}
