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
import { Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  useFacturapiCredenciales,
  useUpsertFacturapiCredenciales,
} from "@/features/configuracion/hooks/useFacturapiCredenciales";
import {
  defaultSecretName,
  type FacturapiAmbiente,
} from "@/features/configuracion/services/facturapiCredenciales";
import FacturapiCredencialesForm from "./FacturapiCredencialesForm";
import { FacturapiWebhookUrlSection } from "./FacturapiWebhookUrlSection";


export default function FacturapiCredencialesCard() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  const { data, isLoading } = useFacturapiCredenciales(orgId);
  const upsert = useUpsertFacturapiCredenciales(orgId);

  const [ambiente, setAmbiente] = useState<FacturapiAmbiente>("sandbox");
  const [facturapiOrgId, setFacturapiOrgId] = useState("");
  const [secretSandbox, setSecretSandbox] = useState("");
  const [secretLive, setSecretLive] = useState("");
  const [datosFiscales, setDatosFiscales] = useState(false);
  const [csdCargado, setCsdCargado] = useState(false);
  const [csdVence, setCsdVence] = useState("");

  useEffect(() => {
    if (!orgId) return;
    setAmbiente((data?.ambiente as FacturapiAmbiente) ?? "sandbox");
    setFacturapiOrgId(data?.facturapi_org_id ?? "");
    setSecretSandbox(data?.api_key_sandbox_secret_name ?? defaultSecretName(orgId, "sandbox"));
    setSecretLive(data?.api_key_live_secret_name ?? defaultSecretName(orgId, "live"));
    setDatosFiscales(data?.datos_fiscales_completos ?? false);
    setCsdCargado(data?.certificado_cargado ?? false);
    setCsdVence(data?.certificado_vence_at ?? "");
  }, [data, orgId]);

  if (!orgId) return null;

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto).then(
      () => toast.success("Copiado"),
      () => notifyError(undefined, { title: "No se pudo copiar", method: "FacturapiCredencialesCard.copiar" }),
    );
  };

  const onGuardar = async () => {
    try {
      await upsert.mutateAsync({
        ambiente,
        facturapi_org_id: facturapiOrgId.trim() || null,
        api_key_sandbox_secret_name: secretSandbox.trim() || null,
        api_key_live_secret_name: secretLive.trim() || null,
        datos_fiscales_completos: datosFiscales,
        certificado_cargado: csdCargado,
        certificado_vence_at: csdVence || null,
      });
      notifySuccess(undefined, { title: "Configuración de FacturApi guardada" });
    } catch (err) {
      notifyError(undefined, { title: "No se pudo guardar la configuración", method: "FacturapiCredencialesCard.onGuardar", error: err });
    }
  };

  const configurado = !!data && (ambiente === "sandbox" ? !!secretSandbox : !!secretLive);
  const secretActivo = ambiente === "sandbox" ? secretSandbox : secretLive;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" /> FacturApi (Timbrado SAT)
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
        </CardTitle>
        <CardDescription>
          Conecta tu cuenta de FacturApi para timbrar CFDI 4.0 desde Libre Carga.
          La API key se guarda como secret en el servidor; aquí sólo configuras
          el ambiente activo y el nombre del secret.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        <FacturapiCredencialesForm
          orgId={orgId}
          ambiente={ambiente}
          setAmbiente={setAmbiente}
          facturapiOrgId={facturapiOrgId}
          setFacturapiOrgId={setFacturapiOrgId}
          secretSandbox={secretSandbox}
          setSecretSandbox={setSecretSandbox}
          secretLive={secretLive}
          setSecretLive={setSecretLive}
          datosFiscales={datosFiscales}
          setDatosFiscales={setDatosFiscales}
          csdCargado={csdCargado}
          setCsdCargado={setCsdCargado}
          csdVence={csdVence}
          setCsdVence={setCsdVence}
          copiar={copiar}
        />

        <FacturapiWebhookUrlSection orgId={orgId} copiar={copiar} />




        <div className="flex justify-end gap-2">
          <Button onClick={onGuardar} disabled={upsert.isPending}>
            {upsert.isPending ? "Guardando…" : "Guardar configuración"}
          </Button>
        </div>

        {configurado && secretActivo && (
          <p className="text-[11px] text-muted-foreground">
            Al timbrar, la función usará el secret <code className="font-mono">{secretActivo}</code>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
