/**
 * Muestra al admin la URL del webhook FacturApi pre-formateada con `?org=<UUID>`
 * para que la configure en FacturApi Dashboard → Webhooks. Antes había que
 * construirla a mano (fuente de errores: omitir el query param o pegar el ref
 * equivocado del proyecto).
 *
 * v13.137.13 — cierra el pendiente 7 del plan fiscal (sincronización REP).
 * P2-A — la clave de firma es POR AMBIENTE y se puede verificar contra el
 * proveedor desde aquí.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Webhook } from "lucide-react";
import { FacturapiWebhookDiagnostico } from "./FacturapiWebhookDiagnostico";
import type { FacturapiCredencialesRow } from "../services/facturapiCredenciales";

interface Props {
  orgId: string;
  copiar: (texto: string) => void;
  /** Credenciales guardadas (null si aún no hay). El ambiente activo manda. */
  cred?: FacturapiCredencialesRow | null;
}

export function FacturapiWebhookUrlSection({ orgId, copiar, cred = null }: Props) {
  const ambiente = cred?.ambiente ?? "sandbox";
  const esLive = ambiente === "live";
  const estadoGuardado = (esLive ? cred?.webhook_estado_live : cred?.webhook_estado_sandbox) ?? null;
  const verificadoAt =
    (esLive ? cred?.webhook_verificado_live_at : cred?.webhook_verificado_sandbox_at) ?? null;


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
          La clave de firma (HMAC SHA-256) es independiente por ambiente: una para
          Pruebas y otra para Producción. Pega en FacturApi la del ambiente que
          estés configurando como <em>Webhook Secret</em>.
        </AlertDescription>
      </Alert>
      <FacturapiWebhookDiagnostico
        orgId={orgId}
        ambiente={ambiente}
        estadoGuardado={estadoGuardado}
        verificadoAt={verificadoAt}

      />

    </div>
  );
}
