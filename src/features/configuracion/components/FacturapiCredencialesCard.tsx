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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Receipt, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";
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

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Paso 1:</strong> Crea tu cuenta en{" "}
            <a href="https://facturapi.io" target="_blank" rel="noreferrer" className="underline">facturapi.io</a>{" "}
            y copia tu API key (sandbox o live).<br />
            <strong>Paso 2:</strong> En Lovable Cloud → Backend → Secrets, agrega un secret
            con el nombre sugerido abajo y pega la API key como valor.<br />
            <strong>Paso 3:</strong> Guarda esta configuración y cambia el ambiente a
            "Producción" cuando hayas probado con sandbox.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ambiente activo</Label>
            <div className="flex items-center gap-3">
              <span className={ambiente === "sandbox" ? "font-medium" : "text-muted-foreground"}>Sandbox</span>
              <Switch
                checked={ambiente === "live"}
                onCheckedChange={(v) => setAmbiente(v ? "live" : "sandbox")}
                aria-label="Cambiar ambiente"
              />
              <span className={ambiente === "live" ? "font-medium" : "text-muted-foreground"}>Producción</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Define qué API key usar al timbrar. Empieza siempre en Sandbox.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="facturapi_org_id">Organization ID en FacturApi (opcional)</Label>
            <Input
              id="facturapi_org_id"
              value={facturapiOrgId}
              onChange={(e) => setFacturapiOrgId(e.target.value)}
              placeholder="ej. 5f4e3d2c1b…"
            />
            <p className="text-[11px] text-muted-foreground">
              Sólo necesario si usas una cuenta multi-organización en FacturApi.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secret_sandbox">Nombre del secret — Sandbox</Label>
          <div className="flex gap-2">
            <Input
              id="secret_sandbox"
              value={secretSandbox}
              onChange={(e) => setSecretSandbox(e.target.value)}
              placeholder={defaultSecretName(orgId, "sandbox")}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => copiar(secretSandbox)} aria-label="Copiar nombre">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secret_live">Nombre del secret — Producción</Label>
          <div className="flex gap-2">
            <Input
              id="secret_live"
              value={secretLive}
              onChange={(e) => setSecretLive(e.target.value)}
              placeholder={defaultSecretName(orgId, "live")}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => copiar(secretLive)} aria-label="Copiar nombre">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Agrega secrets con estos nombres en Backend → Secrets antes de timbrar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label className="text-sm">Datos fiscales</Label>
              <p className="text-[11px] text-muted-foreground">RFC, régimen, domicilio</p>
            </div>
            <Switch checked={datosFiscales} onCheckedChange={setDatosFiscales} />
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label className="text-sm">CSD cargado</Label>
              <p className="text-[11px] text-muted-foreground">En FacturApi</p>
            </div>
            <Switch checked={csdCargado} onCheckedChange={setCsdCargado} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="csd_vence" className="text-sm">CSD vence</Label>
            <Input
              id="csd_vence"
              type="date"
              value={csdVence}
              onChange={(e) => setCsdVence(e.target.value)}
            />
          </div>
        </div>

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
