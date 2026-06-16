import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { EMAIL_RE, type Contacto } from "@/features/cotizacion/hooks/useEnvioCotizacionForm";

interface Props {
  contactos: Contacto[];
  loadingContactos: boolean;
  seleccionados: Record<string, boolean>;
  onToggle: (id: string, v: boolean) => void;
  emailManual: string;
  setEmailManual: (v: string) => void;
  emailsManualesAgregados: string[];
  agregarManual: () => void;
  quitarManual: (e: string) => void;
}

export function DestinatariosPicker({
  contactos, loadingContactos, seleccionados, onToggle,
  emailManual, setEmailManual, emailsManualesAgregados, agregarManual, quitarManual,
}: Props) {
  return (
    <div className="space-y-2">
      <Label>Destinatarios</Label>
      {loadingContactos && <p className="text-sm text-muted-foreground">Cargando contactos…</p>}
      {!loadingContactos && contactos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este cliente no tiene contactos con email. Agrega uno manualmente abajo.
        </p>
      )}
      <div className="space-y-1">
        {contactos.map((c) => (
          <label key={c.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={!!seleccionados[c.id]}
              onCheckedChange={(v) => onToggle(c.id, !!v)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {c.contacto || c.nombre}{" "}
                {c.tipo && <Badge variant="outline" className="ml-1 text-xs">{c.tipo}</Badge>}
              </p>
              <p className="text-xs text-muted-foreground truncate">{c.email}</p>
            </div>
          </label>
        ))}
      </div>
      {emailsManualesAgregados.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {emailsManualesAgregados.map((e) => (
            <Badge key={e} variant="secondary" className="gap-1">
              {e}
              <button type="button" onClick={() => quitarManual(e)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="agregar email manual"
          value={emailManual}
          onChange={(e) => setEmailManual(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarManual(); } }}
        />
        <Button type="button" variant="outline" onClick={agregarManual} disabled={!EMAIL_RE.test(emailManual.trim())}>
          Agregar
        </Button>
      </div>
    </div>
  );
}
