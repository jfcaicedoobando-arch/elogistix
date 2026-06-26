/**
 * Sub-componente presentacional del formulario de credenciales FacturApi.
 * Extraído de FacturapiCredencialesCard para respetar Power of 10 (≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy } from "lucide-react";
import {
  defaultSecretName,
  type FacturapiAmbiente,
} from "@/features/configuracion/services/facturapiCredenciales";

type Props = {
  orgId: string;
  ambiente: FacturapiAmbiente;
  setAmbiente: (v: FacturapiAmbiente) => void;
  facturapiOrgId: string;
  setFacturapiOrgId: (v: string) => void;
  secretSandbox: string;
  setSecretSandbox: (v: string) => void;
  secretLive: string;
  setSecretLive: (v: string) => void;
  datosFiscales: boolean;
  setDatosFiscales: (v: boolean) => void;
  csdCargado: boolean;
  setCsdCargado: (v: boolean) => void;
  csdVence: string;
  setCsdVence: (v: string) => void;
  copiar: (texto: string) => void;
};

export default function FacturapiCredencialesForm(props: Props) {
  const {
    orgId, ambiente, setAmbiente, facturapiOrgId, setFacturapiOrgId,
    secretSandbox, setSecretSandbox, secretLive, setSecretLive,
    datosFiscales, setDatosFiscales, csdCargado, setCsdCargado,
    csdVence, setCsdVence, copiar,
  } = props;

  return (
    <>
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
    </>
  );
}
