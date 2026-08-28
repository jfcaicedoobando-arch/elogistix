/**
 * Definición de columnas de la tabla /anticipos-proveedor.
 * Extraído de `AnticiposProveedor.tsx` (v13.317.9).
 */
import { MoreHorizontal, Ban, Link2, Ship, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import type { AnticipoProveedorRow } from "../../hooks/useAnticiposProveedor";

type CellCtx = {
  getValue: () => unknown;
  row: { original: AnticipoProveedorRow };
};

interface Options {
  canEditFinance: boolean;
  onAplicar: (row: AnticipoProveedorRow) => void;
  onCancelar: (row: AnticipoProveedorRow) => void;
  onDevolver: (row: AnticipoProveedorRow) => void;
  onVincularEmbarque: (row: AnticipoProveedorRow) => void;
}

function EmbarqueCell({ row }: { row: AnticipoProveedorRow }) {
  const navigate = useNavigate();
  if (!row.embarque_id) {
    return <span className="text-xs italic text-muted-foreground">Sin embarque</span>;
  }
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Ver embarque ${row.embarque_expediente ?? row.embarque_id.slice(0, 8)}`}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/embarques/${row.embarque_id}`);
      }}
      className="h-auto p-0 font-mono text-sm font-normal text-accent hover:bg-transparent hover:underline"
    >
      {row.embarque_expediente ?? row.embarque_id.slice(0, 8)}
    </Button>
  );
}


function EstadoCell({ value }: { value: string }) {
  if (value === "disponible") return <ToneBadge tone="success">Disponible</ToneBadge>;
  if (value === "aplicado_parcial") return <ToneBadge tone="warning">Parcial</ToneBadge>;
  if (value === "aplicado_total") return <ToneBadge tone="neutral">Aplicado</ToneBadge>;
  if (value === "cancelado") return <ToneBadge tone="destructive">Cancelado</ToneBadge>;
  if (value === "devuelto") return <ToneBadge tone="warning">Devuelto</ToneBadge>;
  return <ToneBadge tone="neutral">{value}</ToneBadge>;
}

export function buildAnticipoColumns({
  canEditFinance, onAplicar, onCancelar, onDevolver, onVincularEmbarque,
}: Options) {
  return [
    {
      header: "Fecha",
      accessorKey: "fecha_anticipo",
      cell: (info: CellCtx) => formatDate(info.getValue() as string),
    },
    { header: "Proveedor", accessorKey: "proveedor_nombre" },
    {
      header: "Embarque",
      accessorKey: "embarque_expediente",
      cell: (info: CellCtx) => <EmbarqueCell row={info.row.original} />,
    },

    {
      header: "Monto",
      accessorKey: "monto",
      cell: (info: CellCtx) => formatCurrency(info.getValue() as number, info.row.original.moneda),
    },
    {
      header: "Aplicado",
      accessorKey: "aplicado",
      cell: (info: CellCtx) => formatCurrency(info.getValue() as number, info.row.original.moneda),
    },
    {
      header: "Disponible",
      accessorKey: "disponible",
      cell: (info: CellCtx) => (
        <span className="font-semibold text-primary">
          {formatCurrency(info.getValue() as number, info.row.original.moneda)}
        </span>
      ),
    },
    { header: "Moneda", accessorKey: "moneda" },
    {
      header: "Estado",
      accessorKey: "estado",
      cell: (info: CellCtx) => <EstadoCell value={info.getValue() as string} />,
    },
    {
      id: "actions",
      cell: (info: CellCtx) => {
        const row = info.row.original;
        const canApply = row.estado === "disponible" || row.estado === "aplicado_parcial";
        const canCancel = row.estado === "disponible";
        // N13: sólo tiene sentido devolver lo que aún queda sin aplicar.
        const canDevolver =
          (row.estado === "disponible" || row.estado === "aplicado_parcial") && row.disponible > 0;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Acciones del anticipo">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!canApply || !canEditFinance}
                onClick={() => onAplicar(row)}
              >
                <Link2 className="mr-2 h-4 w-4" /> Aplicar
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={row.estado === "cancelado" || !canEditFinance}
                onClick={() => onVincularEmbarque(row)}
              >
                <Ship className="mr-2 h-4 w-4" /> Vincular embarque
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canDevolver || !canEditFinance}
                onClick={() => onDevolver(row)}
              >
                <Undo2 className="mr-2 h-4 w-4" /> Registrar devolución
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                disabled={!canCancel || !canEditFinance}
                onClick={() => onCancelar(row)}
              >
                <Ban className="mr-2 h-4 w-4" /> Cancelar
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
