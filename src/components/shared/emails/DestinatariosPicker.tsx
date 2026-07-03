/**
 * DestinatariosPicker — Reutilizable para cualquier envío de documento
 * al cliente (cotización, proforma, factura). Recibe la lista de contactos
 * con email del cliente y expone los toggles + input manual.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, AlertTriangle } from "lucide-react";
import { EMAIL_RE, type Contacto } from "@/hooks/emails/useEnvioDocumentoForm";
import { esContactoProveedor, CLIENTE_PRINCIPAL_ID } from "@/features/cotizacion/services/envios";

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

function ContactoRow({
  c, checked, onToggle, warning = false,
}: {
  c: Contacto; checked: boolean; onToggle: (v: boolean) => void; warning?: boolean;
}) {
  const esPrincipal = c.id === CLIENTE_PRINCIPAL_ID;
  return (
    <label className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onToggle(!!v)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {esPrincipal ? "Email principal del cliente" : c.contacto || c.nombre}{" "}
          {c.tipo && (
            <Badge
              variant={warning ? "destructive" : esPrincipal ? "default" : "outline"}
              className="ml-1 text-xs"
            >
              {c.tipo}
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
      </div>
    </label>
  );
}

export function DestinatariosPicker({
  contactos, loadingContactos, seleccionados, onToggle,
  emailManual, setEmailManual, emailsManualesAgregados, agregarManual, quitarManual,
}: Props) {
  const clienteContactos = contactos.filter((c) => !esContactoProveedor(c));
  const proveedorContactos = contactos.filter(esContactoProveedor);

  return (
    <div className="space-y-2">
      <Label>Destinatarios</Label>
      {loadingContactos && <p className="text-sm text-muted-foreground">Cargando contactos…</p>}
      {!loadingContactos && contactos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este cliente no tiene contactos con email. Agrega uno manualmente abajo.
        </p>
      )}
      {!loadingContactos && clienteContactos.length === 0 && proveedorContactos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Este cliente no tiene contactos propios registrados. Captura el correo del cliente
          manualmente o agrega un contacto en su ficha.
        </p>
      )}

      <div className="space-y-1">
        {clienteContactos.map((c) => (
          <ContactoRow key={c.id} c={c} checked={!!seleccionados[c.id]} onToggle={(v) => onToggle(c.id, v)} />
        ))}
      </div>

      {proveedorContactos.length > 0 && (
        <details className="rounded-md border border-dashed border-muted-foreground/30 px-2 py-1">
          <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1 py-1">
            <AlertTriangle className="h-3 w-3" />
            Mostrar proveedores / shippers ({proveedorContactos.length}) — no recomendado
          </summary>
          <div className="space-y-1 pt-1">
            {proveedorContactos.map((c) => (
              <ContactoRow key={c.id} c={c} checked={!!seleccionados[c.id]} onToggle={(v) => onToggle(c.id, v)} warning />
            ))}
          </div>
        </details>
      )}

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
