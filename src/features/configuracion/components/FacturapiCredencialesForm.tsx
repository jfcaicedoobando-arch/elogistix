/**
 * Sub-componente presentacional del formulario de credenciales FacturApi.
 * v13.137.18 — Self-service: el admin de la org pega aquí sus API keys (sandbox/live).
 * La key real viaja al servidor vía RPC y se guarda cifrada en vault.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FacturapiAmbiente } from "@/features/configuracion/services/facturapiCredenciales";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FacturapiApiKeyRow } from "@/features/configuracion/components/FacturapiApiKeyRow";

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
          <p className="text-label text-muted-foreground">
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
        <FacturapiApiKeyRow orgId={orgId} ambiente="sandbox" last4={sandboxLast4} label="Sandbox" prefijo="sk_test_" />
        <FacturapiApiKeyRow orgId={orgId} ambiente="live" last4={liveLast4} label="Producción" prefijo="sk_live_" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
        <div className="flex items-center justify-between rounded border p-3">
          <div>
            <Label className="text-sm">Datos fiscales</Label>
            <p className="text-label text-muted-foreground">RFC, régimen, domicilio</p>
          </div>
          <Switch checked={datosFiscales} onCheckedChange={setDatosFiscales} />
        </div>
        <div className="flex items-center justify-between rounded border p-3">
          <div>
            <Label className="text-sm">CSD cargado</Label>
            <p className="text-label text-muted-foreground">En FacturApi</p>
          </div>
          <Switch checked={csdCargado} onCheckedChange={setCsdCargado} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="csd_vence" className="text-sm">CSD vence</Label>
          <DatePickerMx value={csdVence} onChange={setCsdVence} />
        </div>
      </div>
    </>
  );
}
