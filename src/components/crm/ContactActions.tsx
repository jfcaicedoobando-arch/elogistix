/**
 * Renderiza email/teléfono accionables: link mailto:/tel: + botón copiar al clipboard.
 */
import { Copy, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess } from "@/lib/ui/appFeedback";

interface Props {
  email?: string | null;
  telefono?: string | null;
}

export default function ContactActions({ email, telefono }: Props) {
  const { toast } = useToast();
  const copy = (v: string, label: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v).then(() => notifySuccess(toast, { title: `${label} copiado` }));
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        {email ? (
          <>
            <a href={`mailto:${email}`} className="text-primary hover:underline truncate">{email}</a>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(email, "Email")} title="Copiar email">
              <Copy className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
        {telefono ? (
          <>
            <a href={`tel:${telefono}`} className="text-primary hover:underline">{telefono}</a>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(telefono, "Teléfono")} title="Copiar teléfono">
              <Copy className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
