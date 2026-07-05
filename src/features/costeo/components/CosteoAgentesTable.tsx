/**
 * Tabla de Agentes de costeo — extraída de CosteoAgentes.tsx.
 * v13.172.17: migrado a `DataTable` (Fase 4 homologación).
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { Trash2, Pencil, UserPlus } from "lucide-react";

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
        cell: ({ row }) => row.original.nombre,
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
        cell: ({ row }) => row.original.contacto_tarifario ?? "—",
      },
      {
        id: "email",
        header: "Email",
        accessorFn: (a) => a.email ?? "",
        cell: ({ row }) => row.original.email ?? "—",
      },
      {
        id: "activo",
        header: "Activo",
        accessorFn: (a) => a.activo ? "1" : "0",
        enableSorting: true,
        cell: ({ row }) => (
          <Badge
            variant={row.original.activo ? "default" : "secondary"}
            className={row.original.activo ? "bg-success/15 text-success border-success/30" : ""}
          >
            {row.original.activo ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
      {
        id: "acciones",
        header: "Acciones",
        meta: { width: "w-24", align: "right" },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onInvitarPortal(a)}
                aria-label={`Invitar al portal del agente ${a.nombre}`}
                title="Invitar al portal del agente"
              >
                <UserPlus className="size-4 text-accent" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEditar(a)}
                aria-label={`Editar agente ${a.nombre}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEliminar({ id: a.id, nombre: a.nombre })}
                aria-label={`Eliminar agente ${a.nombre}`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
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
      />
    </Card>
  );
}
