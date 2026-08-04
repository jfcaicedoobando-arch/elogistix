/**
 * DestinatariosPicker — Lista de contactos del cliente con email para el
 * modal de envío. Los contactos actúan como atajos: al marcar el checkbox
 * el caller agrega/quita el correo del chipfield "Para".
 *
 * La captura de emails manuales y los CC ahora viven en `EmailChipsField`
 * (chip input unificado) para dar congruencia al modal.
 */
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { type Contacto } from "@/hooks/emails/useEnvioDocumentoForm";
import { CLIENTE_PRINCIPAL_ID, esContactoProveedor } from "@/features/cotizacion/services/envios";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  contactos: Contacto[];
  loadingContactos: boolean;
  seleccionados: Record<string, boolean>;
  onToggle: (id: string, v: boolean) => void;
}

function ContactoRow({
  c, checked, onToggle,
}: {
  c: Contacto; checked: boolean; onToggle: (v: boolean) => void;
}) {
  const esPrincipal = c.id === CLIENTE_PRINCIPAL_ID;
  return (
    <label className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onToggle(!!v)} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          <span className="truncate">
            {esPrincipal ? "Email principal del cliente" : c.contacto || c.nombre}
          </span>
          {c.tipo && (
            <Badge
              variant={esPrincipal ? "default" : "outline"}
              className="text-2xs uppercase tracking-wide"
            >
              {c.tipo}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
      </div>
    </label>
  );
}

export function DestinatariosPicker({
  contactos, loadingContactos, seleccionados, onToggle,
}: Props) {
  if (loadingContactos) {
    return <EmptyStateInline loading message="Cargando contactos…" className="py-4" />;
  }
  const clienteContactos = contactos.filter((c) => !esContactoProveedor(c));
  if (clienteContactos.length === 0) return null;

  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Contactos del cliente
      </Label>
      <div className="rounded-md border bg-muted/20 p-1 max-h-48 overflow-auto">
        {clienteContactos.map((c) => (
          <ContactoRow
            key={c.id}
            c={c}
            checked={!!seleccionados[c.id]}
            onToggle={(v) => onToggle(c.id, v)}
          />
        ))}
      </div>
    </div>
  );
}
