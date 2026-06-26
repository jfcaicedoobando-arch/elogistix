/**
 * Paso 3 del wizard FacturApi: probar la conexión contra `organizations/me`.
 * Sólo permite finalizar el wizard cuando la prueba ha sido exitosa.
 */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, PlugZap, Loader2 } from "lucide-react";
import type {
  FacturapiAmbiente,
  ProbarConexionResult,
} from "@/features/configuracion/services/facturapiCredenciales";

function traducirError(status?: number, detail?: unknown): string {
  if (status === 401) {
    return "FacturApi rechazó la API key (401). Verifica que la copiaste completa y que corresponde al ambiente seleccionado.";
  }
  if (status === 404) {
    return "No se encontró la organización en FacturApi (404). Revisa el Organization ID o tu cuenta.";
  }
  if (status === 403) {
    return "La API key no tiene permisos suficientes (403).";
  }
  if (typeof status === "number" && status >= 500) {
    return "FacturApi devolvió un error temporal del servidor. Reintenta en unos segundos.";
  }
  if (status === 0 || status === undefined) {
    return "No se pudo contactar a FacturApi. Revisa tu conexión y reintenta.";
  }
  const msg = typeof detail === "string" ? detail : detail && typeof detail === "object" && "message" in detail ? String((detail as { message: unknown }).message) : "";
  return msg || `FacturApi devolvió un error (${status}).`;
}

interface Props {
  ambiente: FacturapiAmbiente;
  resultado: ProbarConexionResult | null;
  probando: boolean;
  onProbar: () => void;
}

export function PasoProbar({ ambiente, resultado, probando, onProbar }: Props) {
  return (
    <div className="space-y-4">
      <Alert>
        <PlugZap className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Vamos a llamar a FacturApi (ambiente <strong>{ambiente === "live" ? "Producción" : "Sandbox"}</strong>)
          para verificar que la API key funciona y autocompletar tu Organization ID.
          No se genera ningún CFDI en esta prueba.
        </AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <Button type="button" size="lg" onClick={onProbar} disabled={probando}>
          {probando ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Probando conexión…
            </>
          ) : (
            <>
              <PlugZap className="h-4 w-4 mr-2" /> Probar conexión
            </>
          )}
        </Button>
      </div>

      {resultado?.ok && (
        <Alert className="border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-xs space-y-1">
            <div className="font-semibold text-emerald-700">¡Conexión exitosa!</div>
            {resultado.nombre && (
              <div>
                Organización: <strong>{resultado.nombre}</strong>
              </div>
            )}
            {resultado.facturapi_org_id && (
              <div className="flex items-center gap-1">
                Org ID:{" "}
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {resultado.facturapi_org_id}
                </Badge>
              </div>
            )}
            <div className="text-muted-foreground pt-1">
              Ya puedes finalizar el asistente y empezar a timbrar.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {resultado && !resultado.ok && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {traducirError(resultado.status, resultado.detail ?? resultado.message ?? resultado.error)}
          </AlertDescription>
        </Alert>
      )}

      {!resultado && !probando && (
        <p className="text-[11px] text-muted-foreground text-center">
          Aún no has probado la conexión.
        </p>
      )}
    </div>
  );
}
