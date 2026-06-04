/**
 * Controles de paginación para la tabla de hallazgos.
 */
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "./hallazgosTablaConfig";

interface Props {
  pageSize: number;
  currentPage: number;
  totalPages: number;
  start: number;
  total: number;
  onPageSizeChange: (n: number) => void;
  onPageChange: (n: number) => void;
}

export function HallazgosPagination({
  pageSize,
  currentPage,
  totalPages,
  start,
  total,
  onPageSizeChange,
  onPageChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Por página:</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[80px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground tabular-nums">
          {total === 0 ? "0 - 0" : `${start + 1} - ${Math.min(start + pageSize, total)}`} de {total}
        </span>
        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
          «
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Anterior
        </Button>
        <span className="tabular-nums px-2">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Siguiente
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          »
        </Button>
      </div>
    </div>
  );
}
