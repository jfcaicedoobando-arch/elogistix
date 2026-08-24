import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { subscribeToAuthChanges, getCurrentSession, updateUserPassword } from "@/features/auth/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Seo } from "@/components/shared/Seo";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { translateAuthError } from "@/lib/auth/translateAuthError";
import { passwordSchema, PASSWORD_MIN, PASSWORD_MAX } from "@/lib/passwords/policy";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";


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
    message: COPY_VALIDACION.contrasenasNoCoinciden,
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
    watch,

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
    getCurrentSession()
      .then((session) => {
        if (session) setValidSession(true);
        setReady(true);
      })
      .catch((err: unknown) => {
        // EC-08: sin este catch la pantalla quedaba en spinner infinito
        // (setReady nunca corría) si getCurrentSession rechazaba.
        setError(translateAuthError(err instanceof Error ? err.message : null));
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
    <>
      <Seo
        title="Restablecer contraseña · Libre Carga"
        description="Define una nueva contraseña para tu cuenta de Libre Carga, la plataforma de agentes de carga en México. Acceso seguro a embarques, cotizaciones y clientes."
        canonical="https://librecarga.com/reset-password"
        ogTitle="Restablecer contraseña · Libre Carga"
        ogDescription="Crea una nueva contraseña para recuperar el acceso seguro a tu cuenta de Libre Carga."
        ogUrl="https://librecarga.com/reset-password"
      />
      <AuthCard title="Restablecer contraseña" maxWidth="sm">
          {!ready ? (
            <SkeletonGroup loadingLabel="Verificando enlace" className="space-y-4 py-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </SkeletonGroup>
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
                    placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX}
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
                <PasswordStrengthMeter password={watch("password")} />
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
              <Button type="submit" className="w-full" loading={isSubmitting}>
                Actualizar contraseña
              </Button>
            </form>
          )}
      </AuthCard>
    </>
  );
}
