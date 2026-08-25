/**
 * Renderiza email/teléfono accionables: link mailto:/tel: + botón copiar + (opcional) PlantillaSelector.
 */
import { Copy, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { useCopyText } from "@/hooks/shared";
import PlantillaSelector from "@/features/crm/components/PlantillaSelector";

interface PlantillaCtx {
  entidadTipo: "lead" | "oportunidad";
  entidadId: string;
  vars: Record<string, string | number | null | undefined>;
}

interface Props {
  email?: string | null;
  telefono?: string | null;
  plantillaCtx?: PlantillaCtx;
}

export default function ContactActions({ email, telefono, plantillaCtx }: Props) {
  const copyText = useCopyText();
  const copy = (v: string, label: string) => {
    if (!v) return;
    void copyText(v, { successMessage: `${label} copiado`, method: "ContactActions.copy" });
  };

  return (
    <div className="flex flex-col gap-2 text-body">
      <div className="flex items-center gap-2 flex-wrap">
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        {email ? (
          <>
            <a href={`mailto:${email}`} className="text-primary hover:underline truncate rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{email}</a>
            <Hint label="Copiar email">
              <Button size="icon" variant="ghost" className="min-h-11 min-w-11 md:h-6 md:w-6 md:min-h-0 md:min-w-0" onClick={() => copy(email, "Correo")} aria-label="Copiar correo">
                <Copy className="h-3 w-3" />
              </Button>
            </Hint>
            {plantillaCtx && (
              <PlantillaSelector
                canal="email"
                destino={email}
                vars={plantillaCtx.vars}
                entidadTipo={plantillaCtx.entidadTipo}
                entidadId={plantillaCtx.entidadId}
              />
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
        {telefono ? (
          <>
            <a href={`tel:${telefono}`} className="text-primary hover:underline rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{telefono}</a>
            <Hint label="Copiar teléfono">
              <Button size="icon" variant="ghost" className="min-h-11 min-w-11 md:h-6 md:w-6 md:min-h-0 md:min-w-0" onClick={() => copy(telefono, "Teléfono")} aria-label="Copiar teléfono">
                <Copy className="h-3 w-3" />
              </Button>
            </Hint>
            {plantillaCtx && (
              <PlantillaSelector
                canal="whatsapp"
                destino={telefono}
                vars={plantillaCtx.vars}
                entidadTipo={plantillaCtx.entidadTipo}
                entidadId={plantillaCtx.entidadId}
              />
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
