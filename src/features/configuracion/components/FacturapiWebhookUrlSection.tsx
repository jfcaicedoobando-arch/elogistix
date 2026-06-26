/**
 * Muestra al admin la URL del webhook FacturApi pre-formateada con `?org=<UUID>`
 * para que la configure en FacturApi Dashboard → Webhooks. Antes había que
 * construirla a mano (fuente de errores: omitir el query param o pegar el ref
 * equivocado del proyecto).
 *
 * v13.137.13 — cierra el pendiente 7 del plan fiscal (sincronización REP).
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Webhook } from "lucide-react";

interface Props {
  orgId: string;
  copiar: (texto: string) => void;
}

export function FacturapiWebhookUrlSection({ orgId, copiar }: Props) {
  const base = import.meta.env.VITE_SUPABASE_URL ?? "";
  const webhookUrl = base
    ? `${base.replace(/\/$/, "")}/functions/v1/facturapi-webhook?org=${orgId}`
    : "(VITE_SUPABASE_URL no configurada)";

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Webhook className="h-4 w-4" /> Webhook FacturApi
      </div>
      <p className="text-xs text-muted-foreground">
        Copia esta URL y pégala en FacturApi → Dashboard → Webhooks. Sincroniza
        automáticamente cambios de estado de facturas y REPs (timbrado,
        cancelación, entrega por email).
      </p>
      <div className="flex items-center gap-2">
        <Label htmlFor="webhook-url" className="sr-only">URL del webhook</Label>
        <Input
          id="webhook-url"
          readOnly
          value={webhookUrl}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => copiar(webhookUrl)} aria-label="Copiar URL">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <Alert>
        <AlertDescription className="text-xs">
          El secret de firma (HMAC SHA-256) se genera al guardar la configuración
          y vive en <code>facturapi_credenciales.webhook_secret</code>. Pégalo
          también en FacturApi como <em>Webhook Secret</em>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
