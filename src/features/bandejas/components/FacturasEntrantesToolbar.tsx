/**
 * Barra de trabajo del Buzón de facturas de proveedor.
 * v13.365.0 — Búsqueda, chips de filtro, orden y contador.
 */
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHIPS_BUZON,
  ORDENES_BUZON,
  type ChipBuzon,
  type OrdenBuzon,
} from "@/lib/domain/facturasEntrantesBuzon";

interface Props {
  q: string;
  onQChange: (valor: string) => void;
  chip: ChipBuzon;
  onChipChange: (chip: ChipBuzon) => void;
  orden: OrdenBuzon;
  onOrdenChange: (orden: OrdenBuzon) => void;
  visibles: number;
  total: number;
}

export function FacturasEntrantesToolbar({
  q,
  onQChange,
  chip,
  onChipChange,
  orden,
  onOrdenChange,
  visibles,
  total,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full md:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Proveedor, expediente, folio o archivo"
          className="h-9 pl-8"
          aria-label="Buscar documentos del buzón"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {CHIPS_BUZON.map((opcion) => (
          <Button
            key={opcion.id}
            size="sm"
            variant={chip === opcion.id ? "default" : "outline"}
            onClick={() => onChipChange(opcion.id)}
          >
            {opcion.label}
          </Button>
        ))}
      </div>

      <Select value={orden} onValueChange={(v) => onOrdenChange(v as OrdenBuzon)}>
        <SelectTrigger className="h-9 w-full md:w-[200px]" aria-label="Ordenar documentos">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORDENES_BUZON.map((opcion) => (
            <SelectItem key={opcion.id} value={opcion.id}>{opcion.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto">
        <span className="text-xs text-muted-foreground">
          {visibles} de {total} documento{total === 1 ? "" : "s"}
        </span>
        {(chip !== "todos" || q.trim() !== "") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onQChange("");
              onChipChange("todos");
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

