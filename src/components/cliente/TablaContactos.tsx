import { Pencil, Trash2, Loader2, Plus, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { toTitleCase, correctSpanishPlace } from "@/lib/formatters";
import EmptyState from "@/components/empty/EmptyState";
type ContactoCliente = Tables<'contactos_cliente'>;
type TipoContacto = Enums<'tipo_contacto'>;

const tipoBadgeVariant = (tipo: TipoContacto) => {
  switch (tipo) {
    case 'Proveedor': return 'default' as const;
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
  const columns: DataTableColumn<ContactoCliente>[] = [
    { key: "nombre", header: "Nombre", className: "font-medium", render: (c) => toTitleCase(c.nombre) },
    { key: "tipo", header: "Tipo", render: (c) => <Badge variant={tipoBadgeVariant(c.tipo)}>{c.tipo}</Badge> },
    { key: "lugar", header: "País / Ciudad", className: "text-xs", render: (c) => `${correctSpanishPlace(c.pais)}, ${correctSpanishPlace(c.ciudad)}` },
    { key: "contacto", header: "Contacto", className: "text-xs", render: (c) => toTitleCase(c.contacto) },
    { key: "email", header: "Email", className: "text-xs", render: (c) => c.email },
    {
      key: "acciones", header: "Acciones", width: "w-[80px]",
      render: (c) => canEdit ? (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(c); }} aria-label={`Editar contacto ${c.nombre}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} aria-label={`Eliminar contacto ${c.nombre}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Proveedores / Exportadores</CardTitle>
        {canEdit && <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar Contacto</Button>}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={contactos}
            rowKey={(c) => c.id}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={UserX}
                  title="Sin contactos registrados"
                  description="Agrega proveedores, exportadores o importadores para usarlos al crear embarques."
                  primaryAction={canEdit ? { label: "Agregar Contacto", onClick: onAdd } : undefined}
                />
              </div>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
