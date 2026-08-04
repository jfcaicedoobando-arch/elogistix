import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signInWithEmail, resolveLandingRoute } from "@/features/auth/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { translateAuthError } from "@/lib/auth/translateAuthError";
import { resolveDeepLinkDestino } from "@/features/auth/utils/deepLink";

interface Props {
  onForgotPassword: () => void;
  onEmailChange?: (email: string) => void;
}

export function LoginForm({ onForgotPassword, onEmailChange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const { role } = await signInWithEmail(email, password);
      // B-104: si el guard del portal mandó al login desde un deep-link,
      // regresar a la ruta pedida — sólo si pertenece al área del rol
      // (defensa contra open-redirect).
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      const destino = resolveDeepLinkDestino(role, from) ?? resolveLandingRoute(role);
      navigate(destino, { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error desconocido";
      const friendly = translateAuthError(raw);
      setLoginError(friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4" noValidate>
      {loginError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loginError}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="usuario@empresa.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); onEmailChange?.(e.target.value); if (loginError) setLoginError(null); }}
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Button type="button" variant="link" size="sm" onClick={onForgotPassword} className="h-auto p-0 text-xs">
            ¿Olvidaste tu contraseña?
          </Button>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPwd ? "text" : "password"}
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (loginError) setLoginError(null); }}
            onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"))}
            onKeyDown={(e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"))}
            required
            minLength={6}
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            tabIndex={-1}
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsOn && (
          <p className="text-xs text-warning flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Bloq Mayús está activado
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Iniciar sesión
      </Button>
    </form>
  );
}
