/**
 * Tarjeta móvil de la tabla de exportadores/importadores del cliente.
 * Extraída al migrar `TablaContactos` de `DataTable` a `ResponsiveDataTable`.
 */
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toTitleCase, correctSpanishPlace } from "@/lib/formatters";
import type { Tables, Enums } from "@/types/db";

type ContactoCliente = Tables<'contactos_cliente'>;
type TipoContacto = Enums<'tipo_contacto'>;

const tipoBadgeVariant = (tipo: TipoContacto) => {
  switch (tipo) {
    case 'Exportador': return 'secondary' as const;
    case 'Importador': return 'outline' as const;
  }
};

interface Props {
  contacto: ContactoCliente;
  canEdit: boolean;
  onEdit: (contacto: ContactoCliente) => void;
  onDelete: (contactoId: string) => void;
}

export function ContactoMobileCard({ contacto: c, canEdit, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-body truncate">{toTitleCase(c.nombre)}</span>
          <Badge variant={tipoBadgeVariant(c.tipo)}>{c.tipo}</Badge>
        </div>
        <div className="text-label text-muted-foreground truncate mt-0.5">
          {correctSpanishPlace(c.pais)}, {correctSpanishPlace(c.ciudad)}
        </div>
        {(c.contacto || c.email) && (
          <div className="text-label text-muted-foreground truncate mt-0.5">
            {[toTitleCase(c.contacto), c.email].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={(e) => { e.stopPropagation(); onEdit(c); }}
            aria-label={`Editar contacto ${c.nombre}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
            aria-label={`Eliminar contacto ${c.nombre}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
