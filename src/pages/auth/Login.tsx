import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInWithEmail, signUpWithEmail, resolveLandingRoute } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { BRAND } from "@/components/shared/utils/brand";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { Seo } from "@/components/seo/Seo";
import { translateAuthError } from "@/lib/auth/translateAuthError";
import { ForgotPasswordDialog } from "@/pages/auth/ForgotPasswordDialog";

type TabKey = "login" | "signup";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: TabKey = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleTabChange = (value: string) => {
    const next = (value === "signup" ? "signup" : "login") as TabKey;
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "signup") params.set("tab", "signup");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  // --- Login state ---
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
      navigate(resolveLandingRoute(role), { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error desconocido";
      const friendly = translateAuthError(raw);
      setLoginError(friendly);
      // notifyError mantiene el reporte interno (Sentry/bitácora) con el mensaje original.
      notifyError(toast, { title: "No pudimos iniciar sesión", description: friendly, error: err, method: "HANDLE_LOGIN", silent: true });
    } finally {
      setLoading(false);
    }
  };

  // --- Signup state ---
  const [signupName, setSignupName] = useState("");
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
        redirectTo: `${window.location.origin}/inicio`,
      });
      setSignupDone(true);
      toast({ title: "Cuenta creada", description: "Revisa tu correo para confirmar tu cuenta." });
    } catch (err) {
      const friendly = translateAuthError(err instanceof Error ? err.message : null);
      setSignupError(friendly);
      notifyError(toast, { title: "No pudimos crear la cuenta", description: friendly, error: err, method: "HANDLE_SIGNUP", silent: true });
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-8">
      <Seo
        title="Iniciar sesión · Libre Carga"
        description="Accede a tu cuenta de Libre Carga: opera embarques, cotizaciones y clientes desde un solo lugar."
        canonical="https://librecarga.com/login"
        ogTitle="Iniciar sesión · Libre Carga"
        ogDescription="Accede a tu cuenta de Libre Carga para gestionar tus embarques."
        ogUrl="https://librecarga.com/login"
      />
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-4 pb-4">
          <BrandLockup variant="stacked" size="md" subtitle={BRAND.tagline} />
          <h1 className="sr-only">Iniciar sesión en Libre Carga</h1>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
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
                    onChange={(e) => { setEmail(e.target.value); if (loginError) setLoginError(null); }}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs text-accent hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      placeholder="••••••••"
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
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Bloq Mayús está activado
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Iniciar sesión
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {signupDone ? (
                <div className="space-y-3 py-4 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
                  <p className="text-sm font-medium text-foreground">¡Listo! Te enviamos un correo de confirmación.</p>
                  <p className="text-xs text-muted-foreground">Abre el enlace para activar tu cuenta y entrar a Libre Carga.</p>
                </div>
              ) : (
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
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={email} />
    </div>
  );
}
