import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToAuthChanges, getCurrentSession, updateUserPassword } from "@/features/auth/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { BRAND } from "@/components/shared/utils/brand";
import { Seo } from "@/components/shared/Seo";
import { translateAuthError } from "@/lib/auth/translateAuthError";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase emite PASSWORD_RECOVERY cuando el usuario abre el enlace de recovery.
    const sub = subscribeToAuthChanges((event) => {
      if (event === "PASSWORD_RECOVERY") setValidSession(true);
    });
    // Si ya hay sesión activa (el link puso el token), también permitimos.
    getCurrentSession().then((session) => {
      if (session) setValidSession(true);
      setReady(true);
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await updateUserPassword(password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : null));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-8">
      <Seo
        title="Restablecer contraseña · Libre Carga"
        description="Define una nueva contraseña para tu cuenta de Libre Carga, la plataforma de agentes de carga en México. Acceso seguro a embarques, cotizaciones y clientes."
        canonical="https://librecarga.com/reset-password"
      />
      <Card className="w-full max-w-sm shadow-raised">
        <CardHeader className="text-center space-y-4 pb-4">
          <BrandLockup variant="stacked" size="md" subtitle={BRAND.tagline} />
          <h1 className="sr-only">Restablecer contraseña</h1>
        </CardHeader>
        <CardContent className="pt-2">
          {!ready ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : done ? (
            <div className="space-y-3 py-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
              <p className="text-sm font-medium text-foreground">Contraseña actualizada</p>
              <p className="text-xs text-muted-foreground">Te llevaremos al inicio de sesión…</p>
            </div>
          ) : !validSession ? (
            <div className="space-y-3 py-4 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-foreground">Enlace no válido o expirado</p>
              <p className="text-xs text-muted-foreground">Solicita un nuevo enlace desde la pantalla de inicio de sesión.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>Volver al login</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">Ingresa tu nueva contraseña para tu cuenta de Libre Carga.</p>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password-2">Confirmar contraseña</Label>
                <Input
                  id="new-password-2"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Actualizar contraseña
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
