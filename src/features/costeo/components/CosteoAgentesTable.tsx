/**
 * Tabla de Agentes de costeo — extraída de CosteoAgentes.tsx.
 * v13.172.17: migrado a `DataTable` (Fase 4 homologación).
 * v13.225.0 (Lote 5): nombres a Title Case, acciones consolidadas en
 * DropdownMenu (kebab) y navegación por fila → editar.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { Trash2, Pencil, UserPlus, MoreHorizontal } from "lucide-react";
import { toTitleCase } from "@/lib/formatters";

export interface AgenteRow {
  id: string;
  nombre: string;
  proveedor_id: string | null;
  pais: string | null;
  dias_credito: number | null;
  contacto_tarifario: string | null;
  email: string | null;
  activo: boolean | null;
}

interface Props {
  agentes: AgenteRow[];
  isLoading: boolean;
  onEditar: (a: AgenteRow) => void;
  onEliminar: (a: { id: string; nombre: string }) => void;
  onInvitarPortal: (a: AgenteRow) => void;
}

export function CosteoAgentesTable({ agentes, isLoading, onEditar, onEliminar, onInvitarPortal }: Props) {
  const columns = useMemo<ColumnDef<AgenteRow, unknown>[]>(
    () => defineColumns<AgenteRow>([
      {
        id: "nombre",
        header: "Nombre",
        accessorFn: (a) => a.nombre,
        sortingFn: sortByString((a) => a.nombre),
        enableSorting: true,
        meta: { sticky: true, className: "font-medium" },
        cell: ({ row }) => toTitleCase(row.original.nombre) || "—",
      },
      {
        id: "pais",
        header: "País",
        accessorFn: (a) => a.pais ?? "",
        sortingFn: sortByString((a) => a.pais),
        enableSorting: true,
        cell: ({ row }) => row.original.pais ?? "—",
      },
      {
        id: "dias_credito",
        header: "Días crédito",
        accessorFn: (a) => a.dias_credito ?? 0,
        sortingFn: sortByNumber((a) => a.dias_credito),
        enableSorting: true,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => row.original.dias_credito ?? "—",
      },
      {
        id: "contacto",
        header: "Contacto",
        accessorFn: (a) => a.contacto_tarifario ?? "",
        cell: ({ row }) => toTitleCase(row.original.contacto_tarifario ?? "") || "—",
      },
      {
        id: "email",
        header: "Email",
        accessorFn: (a) => a.email ?? "",
        cell: ({ row }) => row.original.email ?? "—",
      },
      statusColumn<AgenteRow>({
        id: "activo",
        header: "Activo",
        domain: "agente",
        accessor: (a) => (a.activo ? "Activo" : "Inactivo"),
      }),
      {
        id: "acciones",
        header: "",
        meta: { width: "w-12", align: "right" },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Acciones para ${a.nombre}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onEditar(a)}>
                    <Pencil className="size-4 mr-2" />Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onInvitarPortal(a)}>
                    <UserPlus className="size-4 mr-2" />Invitar al portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onEliminar({ id: a.id, nombre: a.nombre })}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ]),
    [onEditar, onEliminar, onInvitarPortal],
  );

  return (
    <Card>
      <DataTable<AgenteRow>
        columns={columns}
        data={agentes}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        emptyMessage="Sin agentes registrados."
        onRowClick={onEditar}
      />
    </Card>
  );
}
