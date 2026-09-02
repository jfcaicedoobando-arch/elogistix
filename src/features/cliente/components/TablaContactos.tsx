import { Pencil, Trash2, Plus, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { Tables, Enums } from "@/types/db";
import { toTitleCase, correctSpanishPlace } from "@/lib/formatters";
import EmptyState from "@/components/empty/EmptyState";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ContactoMobileCard } from "@/features/cliente/components/ContactoMobileCard";
type ContactoCliente = Tables<'contactos_cliente'>;
type TipoContacto = Enums<'tipo_contacto'>;

const tipoBadgeVariant = (tipo: TipoContacto) => {
  switch (tipo) {
    case 'Exportador': return 'secondary' as const;
    case 'Importador': return 'outline' as const;
  }
};


interface Props {
  contactos: ContactoCliente[];
  isLoading: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (contacto: ContactoCliente) => void;
  onDelete: (contactoId: string) => void;
}

export default function TablaContactos({ contactos, isLoading, canEdit, onAdd, onEdit, onDelete }: Props) {
  const columns: ColumnDef<ContactoCliente, unknown>[] = defineColumns<ContactoCliente>([
    { id: "nombre", header: "Nombre", meta: { className: "font-medium" }, cell: ({ row }) => toTitleCase(row.original.nombre) },
    { id: "tipo", header: "Tipo", cell: ({ row }) => <Badge variant={tipoBadgeVariant(row.original.tipo)}>{row.original.tipo}</Badge> },
    { id: "lugar", header: "País / Ciudad", meta: { className: "text-xs" }, cell: ({ row }) => `${correctSpanishPlace(row.original.pais)}, ${correctSpanishPlace(row.original.ciudad)}` },
    { id: "contacto", header: "Contacto", meta: { className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.contacto) },
    { id: "email", header: "Email", meta: { className: "text-xs" }, cell: ({ row }) => row.original.email },
    {
      id: "acciones",
      header: "Acciones",
      meta: { width: COL_W.short },
      cell: ({ row }) => {
        const c = row.original;
        return canEdit ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); onEdit(c); }} aria-label={`Editar contacto ${c.nombre}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} aria-label={`Eliminar contacto ${c.nombre}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null;
      },
    },
  ]);

  function renderBody() {
    return (
      <ResponsiveDataTable
        columns={columns}
        data={contactos}
        isLoading={isLoading}
        rowKey={(c) => c.id}
        density={TABLE_DENSITY.embebida}
        mobileCard={(c) => (
          <ContactoMobileCard contacto={c} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
        )}
        emptyState={
          <div className="p-6">
            <EmptyState
              icon={UserX}
              title="Sin contactos registrados"
              description="Agrega exportadores o importadores para usarlos al crear embarques."

              primaryAction={canEdit ? { label: "Agregar Contacto", onClick: onAdd } : undefined}
            />
          </div>
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Exportadores / Importadores</CardTitle>
        {canEdit && <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar Contacto</Button>}
      </CardHeader>
      <CardContent className="p-0">{renderBody()}</CardContent>
    </Card>
  );
}
