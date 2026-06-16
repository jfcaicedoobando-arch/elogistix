import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailMinus } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json().catch(() => ({}));
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success || data.reason === "already_unsubscribed") setStatus("success");
      else {
        setErrorMsg(data.error ?? "No se pudo procesar la baja");
        setStatus("error");
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailMinus className="h-5 w-5" />
            Cancelar suscripción
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando enlace…
            </p>
          )}
          {status === "invalid" && (
            <p className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" /> Este enlace de baja no es válido o ha expirado.
            </p>
          )}
          {status === "already" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Esta dirección ya estaba dada de baja.
            </p>
          )}
          {status === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                ¿Confirmas que deseas dejar de recibir correos de Libre Carga?
              </p>
              <Button onClick={handleConfirm} variant="destructive" className="w-full">
                Confirmar baja
              </Button>
            </>
          )}
          {status === "confirming" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
            </p>
          )}
          {status === "success" && (
            <p className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" /> Listo. Ya no recibirás más correos.
            </p>
          )}
          {status === "error" && (
            <p className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" /> {errorMsg}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
