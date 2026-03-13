import { Pencil, Trash2, Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Tables, Enums } from "@/integrations/supabase/types";
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
        ) : contactos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No hay contactos registrados. Agrega proveedores o exportadores para usarlos en embarques.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>País / Ciudad</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactos.map(contacto => (
                <TableRow key={contacto.id}>
                  <TableCell className="font-medium">{contacto.nombre}</TableCell>
                  <TableCell><Badge variant={tipoBadgeVariant(contacto.tipo)}>{contacto.tipo}</Badge></TableCell>
                  <TableCell className="text-xs">{contacto.pais}, {contacto.ciudad}</TableCell>
                  <TableCell className="text-xs">{contacto.contacto}</TableCell>
                  <TableCell className="text-xs">{contacto.email}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(contacto)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(contacto.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
