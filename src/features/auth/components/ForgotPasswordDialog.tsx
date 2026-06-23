import { useState } from "react";
import { requestPasswordReset } from "@/features/auth/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { translateAuthError } from "@/lib/auth/translateAuthError";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = "" }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleClose = (next: boolean) => {
    if (!next) {
      // Reset al cerrar
      setTimeout(() => {
        setSent(false);
        setError(null);
        setLoading(false);
      }, 200);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      setSent(true);
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : null));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleClose}
      icon={KeyRound}
      title="Recuperar contraseña"
      description="Te enviaremos un enlace a tu correo para que puedas crear una nueva contraseña."
      size="md"
      footer={
        sent ? (
          <Button variant="outline" onClick={() => handleClose(false)}>Cerrar</Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" form="forgot-password-form" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enviar enlace
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="space-y-3 py-2 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
          <p className="text-sm font-medium text-foreground">Enlace enviado</p>
          <p className="text-xs text-muted-foreground">
            Revisa la bandeja de entrada de <strong>{email}</strong>. El enlace expira en 1 hora.
          </p>
        </div>
      ) : (
        <form id="forgot-password-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
        </form>
      )}
    </FormDialogShell>
  );
}
