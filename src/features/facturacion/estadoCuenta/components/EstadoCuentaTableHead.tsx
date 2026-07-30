/**
 * Encabezado de la tabla de Estado de cuenta con orden por columna.
 * Anchos fijos para que ningún importe se parta en 1366 px.
 */
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrdenEstadoCuenta, SortEstadoCuenta } from "../services/estadoCuentaAging";

interface Props {
  sort: SortEstadoCuenta;
  onSort: (key: OrdenEstadoCuenta) => void;
}

function SortIcon({ activo, dir }: { activo: boolean; dir: "asc" | "desc" }) {
  if (!activo) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function EstadoCuentaTableHead({ sort, onSort }: Props) {
  const boton = (key: OrdenEstadoCuenta, label: string, alineadoDerecha = false) => (
    <button
      type="button"
      onClick={() => onSort(key)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        alineadoDerecha && "justify-end w-full",
      )}
    >
      {label}
      <SortIcon activo={sort.key === key} dir={sort.dir} />
    </button>
  );

  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-8" />
        <TableHead className="w-[92px] whitespace-nowrap">{boton("fecha", "Fecha")}</TableHead>
        <TableHead className="w-[86px]">Folio</TableHead>
        <TableHead className="min-w-[110px]">Concepto</TableHead>
        <TableHead className="w-[100px] whitespace-nowrap">{boton("vencimiento", "Vence")}</TableHead>
        <TableHead className="w-[60px] text-right whitespace-nowrap">Días</TableHead>
        <TableHead className="w-[112px] text-right whitespace-nowrap">Cargo</TableHead>
        <TableHead className="w-[112px] text-right whitespace-nowrap">Abono</TableHead>
        <TableHead className="w-[112px] text-right whitespace-nowrap">{boton("saldo", "Saldo", true)}</TableHead>
        <TableHead className="w-[112px] text-right whitespace-nowrap">Acumulado</TableHead>
        <TableHead className="w-[104px]">Estatus</TableHead>
      </TableRow>
    </TableHeader>
  );
}
