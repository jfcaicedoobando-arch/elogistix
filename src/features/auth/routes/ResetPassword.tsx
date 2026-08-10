import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { passwordSchema, PASSWORD_MIN, PASSWORD_MAX } from "@/lib/passwords/policy";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";


/**
 * v13.312.19 — Ola 1 · PR-6 paso 2: migrado de 8 `useState` a RHF+zod.
 */
const resetSchema = z
  .object({
    password: passwordSchema,
    password2: passwordSchema,

  })
  .refine((v) => v.password === v.password2, {
    path: ["password2"],
    message: "Las contraseñas no coinciden.",
  });

type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", password2: "" },
  });

  useEffect(() => {
    const sub = subscribeToAuthChanges((event) => {
      if (event === "PASSWORD_RECOVERY") setValidSession(true);
    });
    getCurrentSession().then((session) => {
      if (session) setValidSession(true);
      setReady(true);
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);

  const onSubmit = async (v: ResetValues) => {
    setError(null);
    try {
      await updateUserPassword(v.password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : null));
    }
  };

  const firstFieldError = errors.password?.message ?? errors.password2?.message ?? null;
  const alertMessage = error ?? firstFieldError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-8">
      <Seo
        title="Restablecer contraseña · Libre Carga"
        description="Define una nueva contraseña para tu cuenta de Libre Carga, la plataforma de agentes de carga en México. Acceso seguro a embarques, cotizaciones y clientes."
        canonical="https://librecarga.com/reset-password"
        ogTitle="Restablecer contraseña · Libre Carga"
        ogDescription="Crea una nueva contraseña para recuperar el acceso seguro a tu cuenta de Libre Carga."
        ogUrl="https://librecarga.com/reset-password"
      />
      <Card className="w-full max-w-sm shadow-raised">
        <CardHeader className="text-center space-y-4 pb-4">
          <BrandLockup variant="stacked" size="md" subtitle={BRAND.tagline} />
          <h1 className="sr-only">Restablecer contraseña</h1>
        </CardHeader>
        <CardContent className="pt-2">
          {!ready ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
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
              <p className="text-xs text-muted-foreground">
                Solicita un nuevo enlace desde la pantalla de inicio de sesión.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                Volver al login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa tu nueva contraseña para tu cuenta de Libre Carga.
              </p>
              {alertMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{alertMessage}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="pr-10"
                    {...register("password")}
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
                  placeholder="Repite tu nueva contraseña"
                  autoComplete="new-password"
                  {...register("password2")}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Actualizar contraseña
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
