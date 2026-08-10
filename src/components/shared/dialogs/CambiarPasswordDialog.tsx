import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { updateOwnPassword } from "@/lib/auth/changePassword";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identificador de telemetría para distinguir origen (portal vs interno). */
  method?: string;
}

/** Traducciones por `error.code` (estable entre versiones de Supabase Auth). */
const CODE_TRANSLATIONS: Record<string, string> = {
  weak_password:
    "Esta contraseña es muy fácil de adivinar o aparece en filtraciones públicas. Elige una más segura (mezcla mayúsculas, minúsculas, números y símbolos, o una frase larga).",
  same_password: "La nueva contraseña debe ser distinta a la actual.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  over_email_send_rate_limit: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  session_not_found:
    "Tu sesión expiró. Cierra sesión y vuelve a entrar para cambiar la contraseña.",
  session_expired:
    "Tu sesión expiró. Cierra sesión y vuelve a entrar para cambiar la contraseña.",
};

/** Fallback por substring del mensaje cuando no hay `code`. */
function traducirPorMensaje(msg: string): string | null {
  const m = msg.toLowerCase();
  const weakHits = ["known to be weak", "is too weak", "weak password", "pwned", "compromised"];
  if (weakHits.some((h) => m.includes(h))) {
    return "Esta contraseña es muy fácil de adivinar o aparece en filtraciones públicas. Elige una más segura.";
  }
  if (m.includes("should be different from the old") || m.includes("same as the existing")) {
    return "La nueva contraseña debe ser distinta a la actual.";
  }
  if (m.includes("at least") && m.includes("character")) {
    return "La contraseña es muy corta. Usa al menos 8 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }
  if (m.includes("session") && (m.includes("expired") || m.includes("missing"))) {
    return "Tu sesión expiró. Cierra sesión y vuelve a entrar para cambiar la contraseña.";
  }
  return null;
}

/**
 * Traduce errores de Supabase Auth (en inglés) a es-MX.
 * Prefiere `error.code` (estable entre versiones) y cae a substring del
 * mensaje cuando no hay code. Devuelve el mensaje original si no hay match.
 */
function traducirErrorPassword(err: unknown): string {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message : "";
  return CODE_TRANSLATIONS[code] ?? traducirPorMensaje(msg) ?? msg ?? "Error desconocido.";
}



/**
 * Diálogo compartido para que cualquier usuario autenticado (interno o de
 * portal) cambie su propia contraseña. Llama a `supabase.auth.updateUser`
 * directamente, así que no requiere RPC ni rol específico.
 */
export function CambiarPasswordDialog({
  open,
  onOpenChange,
  method = "CAMBIAR_PASSWORD",
}: Props) {
  const { toast } = useToast();
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setNueva("");
      setConfirma("");
      setIsPending(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (nueva.length < 8) {
      notifyError(undefined, {
        title: "Contraseña muy corta",
        description: "Mínimo 8 caracteres.",
        method: `${method}_LEN`,
      });
      return;
    }
    if (nueva !== confirma) {
      notifyError(undefined, {
        title: "No coinciden",
        description: "La confirmación no coincide.",
        method: `${method}_MISMATCH`,
      });
      return;
    }
    setIsPending(true);
    try {
      await updateOwnPassword(nueva);
      toast({ title: "Contraseña actualizada" });
      onOpenChange(false);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo actualizar la contraseña",
        description: traducirErrorPassword(err),
        error: err,
        method,
      });
    } finally {
      setIsPending(false);
    }
  };


  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={KeyRound}
      title="Cambiar contraseña"
      description={`Ingresa tu nueva contraseña (mínimo ${PASSWORD_MIN} caracteres).`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cambiar-pass-nueva">Nueva contraseña</Label>
          <Input
            id="cambiar-pass-nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
          />
          <PasswordStrengthMeter password={nueva} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cambiar-pass-confirma">Confirmar contraseña</Label>
          <Input
            id="cambiar-pass-confirma"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            autoComplete="new-password"
            maxLength={72}
          />
        </div>
      </div>
    </FormDialogShell>
  );
}
