/**
 * /sentry — Pantalla de diagnóstico del SDK de Sentry.
 * Muestra estado del cliente, release, environment, usuario y organización.
 * Permite disparar un error de prueba para verificar el pipeline de reportes.
 */
import { useMemo } from "react";
import * as Sentry from "@sentry/react";
import { Bug, CheckCircle2, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { APP_VERSION } from "@/constants/appVersion";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

function maskDsn(dsn: string | undefined): string {
  if (!dsn) return "—";
  try {
    const url = new URL(dsn);
    const key = url.username;
    const masked = key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : "••••";
    return `${url.protocol}//${masked}@${url.host}${url.pathname}`;
  } catch {
    return "(DSN inválido)";
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-mono break-all">{value}</span>
    </div>
  );
}

export default function SentryDiagnostico() {
  const { user, effectiveRole } = useAuth();
  const { organization, organizationId } = useOrganization();

  const sentryInfo = useMemo(() => {
    const client = Sentry.getClient();
    const options = client?.getOptions();
    return {
      active: Boolean(client),
      dsn: options?.dsn,
      release: options?.release,
      environment: options?.environment,
      tracesSampleRate: options?.tracesSampleRate,
    };
  }, []);

  const handleTestError = () => {
    const id = Sentry.captureException(
      new Error(`Error de prueba — Sentry Diagnóstico (${new Date().toISOString()})`),
      { tags: { source: "sentry-diagnostico-ui" } },
    );
    toast({
      title: "Error de prueba enviado",
      description: `Sentry event ID: ${id}. Verifica en el dashboard de Sentry en unos segundos.`,
    });
  };

  const handleTestMessage = () => {
    const id = Sentry.captureMessage("Mensaje de prueba — Sentry Diagnóstico", "info");
    toast({
      title: "Mensaje de prueba enviado",
      description: `Sentry event ID: ${id}.`,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={<Bug className="h-6 w-6 text-primary" />}
        title="Diagnóstico de Sentry"
        description="Estado en runtime del SDK de monitoreo de errores."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {sentryInfo.active ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Sentry está activo
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                Sentry NO está inicializado
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label="Estado"
            value={
              <Badge variant={sentryInfo.active ? "default" : "destructive"}>
                {sentryInfo.active ? "Activo" : "Inactivo"}
              </Badge>
            }
          />
          <Row label="Release" value={sentryInfo.release ?? `libre-carga@${APP_VERSION}`} />
          <Row label="APP_VERSION" value={APP_VERSION} />
          <Row label="Environment" value={sentryInfo.environment ?? import.meta.env.MODE} />
          <Row
            label="Traces sample rate"
            value={
              sentryInfo.tracesSampleRate !== undefined
                ? String(sentryInfo.tracesSampleRate)
                : "—"
            }
          />
          <Row label="DSN" value={maskDsn(sentryInfo.dsn)} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Usuario actual</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="User ID" value={user?.id ?? "—"} />
            <Row label="Rol efectivo" value={effectiveRole ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Organización activa</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Nombre" value={organization?.nombre ?? "—"} />
            <Row label="Org ID" value={organizationId ?? "—"} />
            <Row label="Plan" value={organization?.plan ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Probar el pipeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleTestError} variant="destructive" disabled={!sentryInfo.active}>
            <Send className="h-4 w-4 mr-2" />
            Enviar error de prueba
          </Button>
          <Button onClick={handleTestMessage} variant="outline" disabled={!sentryInfo.active}>
            <Send className="h-4 w-4 mr-2" />
            Enviar mensaje de prueba
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
