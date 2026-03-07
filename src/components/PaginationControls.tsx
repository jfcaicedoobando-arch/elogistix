import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_OPTIONS = [10, 20, 50];

export default function PaginationControls({
  page, totalPages, onPageChange,
  pageSize, onPageSizeChange, pageSizeOptions = DEFAULT_OPTIONS,
}: PaginationControlsProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  return (
    <div className="flex items-center justify-between p-4 border-t bg-muted/30">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Página {page + 1} de {Math.max(totalPages, 1)}
        </span>
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">|</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s} / pág</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
