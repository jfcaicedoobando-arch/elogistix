/**
 * Sub-componente presentacional del formulario de credenciales FacturApi.
 * v13.137.18 — Self-service: el admin de la org pega aquí sus API keys (sandbox/live).
 * La key real viaja al servidor vía RPC y se guarda cifrada en vault.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Trash2, Save, PlugZap, Loader2 } from "lucide-react";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import type { FacturapiAmbiente } from "@/features/configuracion/services/facturapiCredenciales";
import {
  useSetFacturapiApiKey,
  useClearFacturapiApiKey,
  useProbarFacturapiConexion,
} from "@/features/configuracion/hooks/useFacturapiCredenciales";

type Props = {
  orgId: string;
  ambiente: FacturapiAmbiente;
  setAmbiente: (v: FacturapiAmbiente) => void;
  facturapiOrgId: string;
  setFacturapiOrgId: (v: string) => void;
  sandboxLast4: string | null;
  liveLast4: string | null;
  datosFiscales: boolean;
  setDatosFiscales: (v: boolean) => void;
  csdCargado: boolean;
  setCsdCargado: (v: boolean) => void;
  csdVence: string;
  setCsdVence: (v: string) => void;
};

function ApiKeyRow({
  orgId, ambiente, last4, label, prefijo,
}: { orgId: string; ambiente: FacturapiAmbiente; last4: string | null; label: string; prefijo: string }) {
  const [valor, setValor] = useState("");
  const setKey = useSetFacturapiApiKey(orgId);
  const clearKey = useClearFacturapiApiKey(orgId);
  const probar = useProbarFacturapiConexion(orgId);
  const cargada = !!last4;

  const onGuardar = async () => {
    const v = valor.trim();
    if (!v.startsWith(prefijo)) {
      notifyError(undefined, { title: `La key de ${label} debe comenzar con ${prefijo}`, method: "ApiKeyRow.onGuardar" });
      return;
    }
    try {
      await setKey.mutateAsync({ ambiente, apiKey: v });
      setValor("");
      notifySuccess(undefined, { title: `API key (${label}) guardada` });
    } catch { /* notifyError ya viene del hook */ }
  };

  const onProbar = async () => {
    try {
      const res = await probar.mutateAsync(ambiente);
      if (res.ok) {
        notifySuccess(undefined, { title: `Conexión OK${res.nombre ? ` — ${res.nombre}` : ""}` });
      } else {
        notifyError(undefined, { title: "FacturApi rechazó la API key", method: "ApiKeyRow.onProbar", error: res });
      }
    } catch { /* ya notificó */ }
  };

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-2">
          API key — {label}
          {cargada ? (
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Cargada · {prefijo}••••{last4}</Badge>
          ) : (
            <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" /> Vacía</Badge>
          )}
        </Label>
        {cargada && (
          <Button type="button" size="sm" variant="ghost" onClick={() => clearKey.mutate(ambiente)} disabled={clearKey.isPending}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          placeholder={cargada ? "Pega una nueva key para reemplazar" : `${prefijo}…`}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="font-mono text-xs"
        />
        <Button type="button" onClick={onGuardar} disabled={!valor.trim() || setKey.isPending}>
          {setKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
        <Button type="button" variant="outline" onClick={onProbar} disabled={!cargada || probar.isPending}>
          {probar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4 mr-1" />}
          Probar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        La key se guarda cifrada en el servidor. Aquí sólo ves los últimos 4 dígitos.
      </p>
    </div>
  );
}

export default function FacturapiCredencialesForm(props: Props) {
  const {
    orgId, ambiente, setAmbiente, facturapiOrgId, setFacturapiOrgId,
    sandboxLast4, liveLast4,
    datosFiscales, setDatosFiscales, csdCargado, setCsdCargado,
    csdVence, setCsdVence,
  } = props;

  return (
    <>
      <Alert>
        <AlertDescription className="text-xs">
          <strong>1.</strong> Crea tu cuenta en{" "}
          <a href="https://facturapi.io" target="_blank" rel="noreferrer" className="underline">facturapi.io</a>
          {" "}y sube tu CSD.{" "}
          <strong>2.</strong> Copia tu <em>Secret key</em> (Sandbox para pruebas, Live para producción).{" "}
          <strong>3.</strong> Pégala abajo y prueba la conexión. Cuando todo funcione, cambia el ambiente a Producción.
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
            placeholder="se autocompleta al probar la conexión"
          />
        </div>
      </div>

      <div className="space-y-3">
        <ApiKeyRow orgId={orgId} ambiente="sandbox" last4={sandboxLast4} label="Sandbox" prefijo="sk_test_" />
        <ApiKeyRow orgId={orgId} ambiente="live" last4={liveLast4} label="Producción" prefijo="sk_live_" />
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
    </>
  );
}
