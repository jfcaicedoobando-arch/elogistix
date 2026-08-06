/**
 * Controles de paginación — patrón único para TODOS los listados del ERP.
 *
 * Layout (izquierda → derecha):
 *   [Página X de Y · rango "1–20 de 134"]  ...  [« Anterior  Siguiente »]
 *
 * Se usa automáticamente desde `DataTable` (prop `pagination`). Ningún
 * listado debe construir sus propios botones de Anterior/Siguiente: la
 * prueba de arquitectura `pagination-pattern.test.ts` lo verifica.
 */
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PaginationControlsProps {
  /** Página actual, base 0. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  pageSizeLabels?: Record<number, string>;
  /** Total de registros; si se pasa, muestra el rango "1–20 de 134". */
  total?: number;
}

const DEFAULT_OPTIONS = [10, 20, 50];

export default function PaginationControls({
  page, totalPages, onPageChange,
  pageSize, onPageSizeChange, pageSizeOptions = DEFAULT_OPTIONS,
  pageSizeLabels, total,
}: PaginationControlsProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const ultima = Math.max(totalPages, 1) - 1;
  const enPrimera = page <= 0;
  const enUltima = page >= ultima;
  const desde = total && total > 0 && pageSize ? page * pageSize + 1 : 0;
  const hasta = total && pageSize ? Math.min((page + 1) * pageSize, total) : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t bg-muted/30">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          Página {page + 1} de {Math.max(totalPages, 1)}
        </span>
        {typeof total === "number" && (
          <span className="text-sm text-muted-foreground tabular-nums">
            · {total === 0 ? "0" : `${desde}–${hasta}`} de {total}
          </span>
        )}
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">|</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {pageSizeLabels?.[s] ?? `${s} / pág`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm" className="h-8 w-8 p-0"
          aria-label="Primera página"
          disabled={enPrimera} onClick={() => onPageChange(0)}
        >
          «
        </Button>
        <Button variant="outline" size="sm" disabled={enPrimera} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={enUltima} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
        <Button
          variant="outline" size="sm" className="h-8 w-8 p-0"
          aria-label="Última página"
          disabled={enUltima} onClick={() => onPageChange(ultima)}
        >
          »
        </Button>
      </div>
    </div>
  );
}
