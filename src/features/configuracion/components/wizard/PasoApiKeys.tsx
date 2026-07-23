/**
 * Paso 2 del wizard FacturApi: capturar y guardar las API keys (sandbox + live).
 * La key se cifra en vault vía RPC `set_facturapi_api_key`; aquí sólo se ve `last4`.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Trash2, Save, Loader2, Key } from "lucide-react";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import type { FacturapiAmbiente } from "@/features/configuracion/services/facturapiCredenciales";
import {
  useSetFacturapiApiKey,
  useClearFacturapiApiKey,
} from "@/features/configuracion/hooks/useFacturapiCredenciales";

interface KeyRowProps {
  orgId: string;
  ambiente: FacturapiAmbiente;
  last4: string | null;
  label: string;
  prefijo: string;
  activo: boolean;
}

function KeyRow({ orgId, ambiente, last4, label, prefijo, activo }: KeyRowProps) {
  const [valor, setValor] = useState("");
  const setKey = useSetFacturapiApiKey(orgId);
  const clearKey = useClearFacturapiApiKey(orgId);
  const cargada = !!last4;

  const onGuardar = async () => {
    const v = valor.trim();
    if (!v.startsWith(prefijo)) {
      notifyError(undefined, {
        title: `La key de ${label} debe comenzar con ${prefijo}`,
        method: "PasoApiKeys.KeyRow.onGuardar",
      });
      return;
    }
    try {
      await setKey.mutateAsync({ ambiente, apiKey: v });
      setValor("");
      notifySuccess(undefined, { title: `API key (${label}) guardada` });
    } catch {
      /* hook ya notificó */
    }
  };

  return (
    <div className={`rounded border p-3 space-y-2 ${activo ? "border-primary/50 bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm flex items-center gap-2 flex-wrap">
          {label}
          {activo && <Badge variant="default" className="text-2xs">ambiente activo</Badge>}
          {cargada ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {prefijo}••••{last4}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Vacía
            </Badge>
          )}
        </Label>
        {cargada && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => clearKey.mutate(ambiente)}
            disabled={clearKey.isPending}
          >
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
          {setKey.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" /> Guardar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  orgId: string;
  ambiente: FacturapiAmbiente;
  sandboxLast4: string | null;
  liveLast4: string | null;
}

export function PasoApiKeys({ orgId, ambiente, sandboxLast4, liveLast4 }: Props) {
  return (
    <div className="space-y-3">
      <Alert>
        <Key className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Copia tu <em>Secret key</em> desde el panel de FacturApi
          (<a href="https://docs.facturapi.io/" target="_blank" rel="noreferrer" className="underline">docs.facturapi.io</a>)
          y pégala aquí. La key se cifra en el servidor; sólo verás los últimos 4 dígitos.
          Sólo necesitas cargar la del <strong>ambiente activo</strong> para avanzar.
        </AlertDescription>
      </Alert>

      <KeyRow
        orgId={orgId}
        ambiente="sandbox"
        last4={sandboxLast4}
        label="API key — Sandbox"
        prefijo="sk_test_"
        activo={ambiente === "sandbox"}
      />
      <KeyRow
        orgId={orgId}
        ambiente="live"
        last4={liveLast4}
        label="API key — Producción"
        prefijo="sk_live_"
        activo={ambiente === "live"}
      />
    </div>
  );
}
