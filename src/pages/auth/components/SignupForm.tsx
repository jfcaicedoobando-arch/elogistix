import { useState } from "react";
import { signUpWithEmail } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { translateAuthError } from "@/lib/auth/translateAuthError";

export function SignupForm() {
  const { toast } = useToast();
  const [signupName, setSignupName] = useState("");
  const [signupCompany, setSignupCompany] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    const companyName = signupCompany.trim();
    if (companyName.length < 2 || companyName.length > 120) {
      setSignupError("El nombre de la empresa debe tener entre 2 y 120 caracteres.");
      return;
    }
    if (signupPassword !== signupPassword2) {
      setSignupError("Las contraseñas no coinciden.");
      return;
    }
    if (!acceptTerms) {
      setSignupError("Debes aceptar los términos para continuar.");
      return;
    }
    setSignupLoading(true);
    try {
      await signUpWithEmail({
        email: signupEmail,
        password: signupPassword,
        fullName: signupName,
        companyName,
        redirectTo: `${window.location.origin}/onboarding`,
      });
      setSignupDone(true);
      toast({ title: "Cuenta creada", description: "Revisa tu correo para confirmar tu cuenta." });
    } catch (err) {
      const friendly = translateAuthError(err instanceof Error ? err.message : null);
      setSignupError(friendly);
      notifyError(toast, { title: "No pudimos crear la cuenta", description: friendly, error: err, method: "HANDLE_SIGNUP" });
    } finally {
      setSignupLoading(false);
    }
  };

  if (signupDone) {
    return (
      <div className="space-y-3 py-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
        <p className="text-sm font-medium text-foreground">¡Listo! Te enviamos un correo de confirmación.</p>
        <p className="text-xs text-muted-foreground">Abre el enlace para activar tu cuenta y entrar a Libre Carga.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4" noValidate>
      {signupError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{signupError}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nombre completo</Label>
        <Input id="signup-name" type="text" placeholder="Juan Pérez" value={signupName} onChange={(e) => setSignupName(e.target.value)} required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-company">Nombre de empresa</Label>
        <Input id="signup-company" type="text" placeholder="Mi Agencia Aduanal S.A. de C.V." value={signupCompany} onChange={(e) => setSignupCompany(e.target.value)} required minLength={2} maxLength={120} autoComplete="organization" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email de trabajo</Label>
        <Input id="signup-email" type="email" placeholder="tu@agencia.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Contraseña</Label>
        <Input id="signup-password" type="password" placeholder="Mínimo 6 caracteres" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password2">Confirmar contraseña</Label>
        <Input id="signup-password2" type="password" placeholder="••••••••" value={signupPassword2} onChange={(e) => setSignupPassword2(e.target.value)} required minLength={6} autoComplete="new-password" />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>
          Acepto los <a href="/legal/terminos" target="_blank" className="text-accent hover:underline">Términos</a> y el <a href="/legal/privacidad" target="_blank" className="text-accent hover:underline">Aviso de privacidad</a>.
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={signupLoading}>
        {signupLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Crear cuenta gratis
      </Button>
    </form>
  );
}
