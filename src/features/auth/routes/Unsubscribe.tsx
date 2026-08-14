import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailMinus } from "lucide-react";
import {
  validateUnsubscribeToken,
  confirmUnsubscribe,
} from "@/features/auth/services/unsubscribeService";
import { COPY_BAJA_CORREOS, COPY_ENLACE, COPY_PASOS } from "@/lib/copy/publicoCopy";
import { AvisoAccionable } from "@/components/shared/states/AvisoAccionable";
import { Seo } from "@/components/shared/Seo";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

type Status = "loading" | "valid" | "invalid" | "already" | "confirming" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await validateUnsubscribeToken(token);
        if (cancelled) return;
        if (data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    setStatus("confirming");
    try {
      const data = await confirmUnsubscribe(token);
      if (data.success || data.reason === "already_unsubscribed") setStatus("success");
      else {
        setErrorMsg(COPY_BAJA_CORREOS.falla);
        setStatus("error");
      }
    } catch (e) {
      // UIB-15 (UX-02): superficie pública — nunca error.message crudo.
      // Ola 17: diagnóstico a Sentry en lugar de `console.error` huérfano.
      reportCaughtError(e, { feature: "auth", op: "unsubscribe_confirm" });
      setErrorMsg(COPY_BAJA_CORREOS.falla);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Seo title="Cancelar suscripción — Libre Carga" noIndex />
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailMinus className="h-5 w-5" />
            {COPY_BAJA_CORREOS.titulo}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* RUX-09: los cambios de estado se anuncian a lectores de pantalla. */}
          <div role="status" aria-live="polite" className="space-y-4">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {COPY_BAJA_CORREOS.validando}
            </p>
          )}
          {status === "invalid" && (
            <AvisoAccionable
              tono="error"
              icon={<XCircle className="h-5 w-5" />}
              titulo="No pudimos validar tu enlace"
              descripcion={COPY_ENLACE.invalido}
              pasos={COPY_PASOS.enlaceInvalido}
              className="border-0 p-0"
            />
          )}
          {status === "already" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> {COPY_BAJA_CORREOS.yaDadoDeBaja}
            </p>
          )}
          {status === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                {COPY_BAJA_CORREOS.confirmar}
              </p>
              <Button onClick={handleConfirm} variant="destructive" className="w-full">
                Confirmar baja
              </Button>
            </>
          )}
          {status === "confirming" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {COPY_BAJA_CORREOS.procesando}
            </p>
          )}
          {status === "success" && (
            <p className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" /> {COPY_BAJA_CORREOS.exito}
            </p>
          )}
          {status === "error" && (
            <AvisoAccionable
              tono="error"
              icon={<XCircle className="h-5 w-5" />}
              titulo="No pudimos aplicar tu baja"
              descripcion={errorMsg}
              pasos={COPY_PASOS.bajaCorreosFalla}
              accion={
                <Button variant="outline" onClick={handleConfirm}>
                  Reintentar
                </Button>
              }
              className="border-0 p-0"
            />
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
