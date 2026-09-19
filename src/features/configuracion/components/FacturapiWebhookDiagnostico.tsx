/**
 * P2-A · Diagnóstico accionable del webhook de facturación electrónica, por
 * ambiente (pruebas / producción). El botón consulta al proveedor y muestra
 * qué falta: dirección distinta, eventos sin suscribir o webhook inactivo.
 *
 * Nunca muestra claves ni secretos: sólo dirección, eventos y estado.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  verificarFacturapiWebhook,
  type DiagnosticoWebhook,
  type EstadoWebhook,
} from "../services/facturapiWebhookVerificacion";
import type { FacturapiAmbiente } from "../services/facturapiCredenciales";

const ETIQUETA_AMBIENTE: Record<FacturapiAmbiente, string> = {
  sandbox: "Pruebas",
  live: "Producción",
};

const ETIQUETA_ESTADO: Record<EstadoWebhook, string> = {
  ok: "Correcto",
  no_configurado: "Sin clave de firma",
  no_encontrado: "No registrado",
  url_distinta: "Dirección distinta",
  eventos_faltantes: "Faltan eventos",
  inactivo: "Inactivo",
  error: "No se pudo verificar",
};

interface Props {
  orgId: string;
  ambiente: FacturapiAmbiente;
  /** Estado guardado de la última verificación (si ya se hizo alguna). */
  estadoGuardado?: string | null;
  verificadoAt?: string | null;
}

export function FacturapiWebhookDiagnostico({ orgId, ambiente, estadoGuardado, verificadoAt }: Props) {
  const [cargando, setCargando] = useState(false);
  const [diag, setDiag] = useState<DiagnosticoWebhook | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const verificar = async () => {
    setCargando(true);
    setMensajeError(null);
    try {
      const res = await verificarFacturapiWebhook(orgId, ambiente);
      setDiag(res.diagnostico ?? null);
      if (!res.diagnostico) setMensajeError(res.message ?? "No se pudo verificar el webhook.");
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo verificar el webhook",
        method: "FacturapiWebhookDiagnostico.verificar",
        error,
      });
    } finally {
      setCargando(false);
    }
  };

  const estado = (diag?.estado ?? estadoGuardado) as EstadoWebhook | undefined;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          Ambiente {ETIQUETA_AMBIENTE[ambiente]}
          {estado ? (
            <Badge variant={estado === "ok" ? "secondary" : "destructive"}>
              {ETIQUETA_ESTADO[estado] ?? estado}
            </Badge>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void verificar()} disabled={cargando}>
          {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Verificar con el proveedor
        </Button>
      </div>

      {verificadoAt && !diag ? (
        <p className="text-xs text-muted-foreground">
          Última verificación: {new Date(verificadoAt).toLocaleString("es-MX")}
        </p>
      ) : null}

      {mensajeError ? (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{mensajeError}</AlertDescription>
        </Alert>
      ) : null}

      {diag ? (
        <Alert variant={diag.estado === "ok" ? "default" : "destructive"}>
          <AlertDescription className="space-y-1 text-xs">
            <p>{diag.mensaje}</p>
            {diag.urlRemota && diag.urlRemota !== diag.urlEsperada ? (
              <p className="font-mono break-all">Registrada: {diag.urlRemota}</p>
            ) : null}
            {diag.eventosFaltantes.length > 0 ? (
              <p>Eventos por suscribir: {diag.eventosFaltantes.join(", ")}</p>
            ) : null}
            {diag.secretLegado ? (
              <p>
                Esta organización todavía usa la clave de firma anterior, compartida entre ambientes.
                Guarda una clave para {ETIQUETA_AMBIENTE[ambiente].toLowerCase()} para separarlas.
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
