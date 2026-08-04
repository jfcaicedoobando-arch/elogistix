/**
 * Tarjeta de configuración de FacturApi por organización (multi-tenant v13.136.x).
 *
 * Esta UI NO captura la API key real. La key se guarda como secret en
 * Lovable Cloud (Backend → Secrets) con el nombre que esta tarjeta sugiere
 * (ej. `FACTURAPI_KEY_ACME_SANDBOX`). Aquí sólo se persiste el ambiente
 * activo, el nombre del secret y metadatos (org id en FacturApi, estado del CSD).
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useCopyText } from "@/hooks/shared";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  useFacturapiCredenciales,
  useUpsertFacturapiCredenciales,
} from "@/features/configuracion/hooks/useFacturapiCredenciales";
import { type FacturapiAmbiente } from "@/features/configuracion/services/facturapiCredenciales";
import FacturapiCredencialesForm from "./FacturapiCredencialesForm";
import { FacturapiWebhookUrlSection } from "./FacturapiWebhookUrlSection";
import FacturapiOnboardingWizard from "./FacturapiOnboardingWizard";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
function HeaderBadges({ configurado, ambiente }: { configurado: boolean; ambiente: FacturapiAmbiente }) {
  return (
    <>
      {configurado ? (
        <Badge variant="secondary" className="ml-2 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Configurado
        </Badge>
      ) : (
        <Badge variant="outline" className="ml-2 gap-1">
          <AlertTriangle className="h-3 w-3" /> Sin configurar
        </Badge>
      )}
      <Badge variant={ambiente === "live" ? "default" : "outline"} className="ml-1">
        {ambiente === "live" ? "Producción" : "Sandbox"}
      </Badge>
    </>
  );
}

export default function FacturapiCredencialesCard() {
  const { organization } = useOrganization();
  const copy = useCopyText();
  const orgId = organization?.id ?? null;
  const { data, isLoading } = useFacturapiCredenciales(orgId);
  const upsert = useUpsertFacturapiCredenciales(orgId);

  const [ambiente, setAmbiente] = useState<FacturapiAmbiente>("sandbox");
  const [facturapiOrgId, setFacturapiOrgId] = useState("");
  const [datosFiscales, setDatosFiscales] = useState(false);
  const [csdCargado, setCsdCargado] = useState(false);
  const [csdVence, setCsdVence] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setAmbiente((data?.ambiente as FacturapiAmbiente) ?? "sandbox");
    setFacturapiOrgId(data?.facturapi_org_id ?? "");
    setDatosFiscales(data?.datos_fiscales_completos ?? false);
    setCsdCargado(data?.certificado_cargado ?? false);
    setCsdVence(data?.certificado_vence_at ?? "");
  }, [data, orgId]);

  if (!orgId) return null;

  const copiar = (texto: string) => {
    void copy(texto, { errorTitle: "No se pudo copiar", method: "FacturapiCredencialesCard.copiar" });
  };

  const onGuardar = async () => {
    try {
      await upsert.mutateAsync({
        ambiente,
        facturapi_org_id: facturapiOrgId.trim() || null,
        datos_fiscales_completos: datosFiscales,
        certificado_cargado: csdCargado,
        certificado_vence_at: csdVence || null,
      });
      notifySuccess(undefined, { title: "Configuración de FacturApi guardada" });
    } catch (err) {
      notifyError(undefined, { title: "No se pudo guardar la configuración", method: "FacturapiCredencialesCard.onGuardar", error: err });
    }
  };

  const sandboxLast4 = data?.api_key_sandbox_last4 ?? null;
  const liveLast4 = data?.api_key_live_last4 ?? null;
  const configurado = !!data && (ambiente === "sandbox" ? !!sandboxLast4 : !!liveLast4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" /> FacturApi (Timbrado SAT)
          <HeaderBadges configurado={configurado} ambiente={ambiente} />
        </CardTitle>
        <CardDescription>
          Conecta tu cuenta de FacturApi para timbrar CFDI 4.0 desde Libre Carga.
          Pega abajo tus API keys de Sandbox y Producción; se guardan cifradas
          en el servidor y nunca regresan al navegador.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && <EmptyStateInline loading message="Cargando…" className="py-4" />}

        <div className="flex items-center justify-between gap-3 rounded border border-dashed p-3 bg-muted/30">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {configurado ? "Reconfigurar conexión" : "Asistente paso a paso"}
            </p>
            <p className="text-label text-muted-foreground">
              {configurado
                ? "Vuelve a ejecutar el wizard si cambiaste de ambiente o rotaste tus keys."
                : "Te guiamos en 3 pasos para vincular tu cuenta de FacturApi."}
            </p>
          </div>
          <Button type="button" onClick={() => setWizardOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" />
            {configurado ? "Reconfigurar" : "Conectar FacturApi"}
          </Button>
        </div>

        <details className="rounded border">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30">
            Modo avanzado — editar campos manualmente
          </summary>
          <div className="p-3 space-y-4">
            <FacturapiCredencialesForm
              orgId={orgId}
              ambiente={ambiente}
              setAmbiente={setAmbiente}
              facturapiOrgId={facturapiOrgId}
              setFacturapiOrgId={setFacturapiOrgId}
              sandboxLast4={sandboxLast4}
              liveLast4={liveLast4}
              datosFiscales={datosFiscales}
              setDatosFiscales={setDatosFiscales}
              csdCargado={csdCargado}
              setCsdCargado={setCsdCargado}
              csdVence={csdVence}
              setCsdVence={setCsdVence}
            />
            <div className="flex justify-end">
              <Button onClick={onGuardar} disabled={upsert.isPending} variant="outline" size="sm">
                {upsert.isPending ? "Guardando…" : "Guardar configuración"}
              </Button>
            </div>
          </div>
        </details>

        <FacturapiWebhookUrlSection orgId={orgId} copiar={copiar} />

        <FacturapiOnboardingWizard
          orgId={orgId}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
        />
      </CardContent>
    </Card>
  );
}

