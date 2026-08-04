/**
 * ContactosClienteList — Lista de contactos del cliente para elegir
 * destinatario al enviar un CFDI. Extraído de DialogEnviarCfdi para
 * mantener el archivo padre bajo el límite Power-of-10 (200 líneas).
 */
import { User, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContactoEnvio } from "@/features/facturacion/hooks/useContactosClienteParaEnvio";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface ContactoItemProps {
  contacto: ContactoEnvio;
  seleccionado: boolean;
  onPick: (email: string) => void;
}

function ContactoItem({ contacto: c, seleccionado, onPick }: ContactoItemProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(c.email)}
      className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
        seleccionado ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <User className="h-3 w-3 text-muted-foreground" />
          {c.nombre ?? "(Sin nombre)"}
          {c.esFacturacion && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">Facturación</Badge>
          )}
        </div>
        {c.tipo && !c.esFacturacion && (
          <span className="text-[10px] text-muted-foreground">{c.tipo}</span>
        )}
      </div>
      <div className="text-muted-foreground mt-0.5 truncate">{c.email}</div>
    </button>
  );
}

interface ContactosListProps {
  cargando: boolean;
  contactos: ContactoEnvio[];
  emailCliente: string | null | undefined;
  emailSeleccionado: string;
  onPick: (email: string) => void;
}

export function ContactosClienteList({
  cargando,
  contactos,
  emailCliente,
  emailSeleccionado,
  onPick,
}: ContactosListProps) {
  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <EmptyStateInline loading message="Cargando contactos…" className="py-2" />
      </div>
    );
  }
  if (contactos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Este cliente no tiene contactos con email registrados.
        {emailCliente && " Se usará el email de la ficha del cliente."}
      </p>
    );
  }
  const seleccionadoLower = emailSeleccionado.trim().toLowerCase();
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
      {contactos.map((c) => (
        <ContactoItem
          key={c.id}
          contacto={c}
          seleccionado={seleccionadoLower === c.email.toLowerCase()}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
