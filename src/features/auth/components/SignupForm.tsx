import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { signUpWithEmail } from "@/features/auth/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { translateAuthError } from "@/lib/auth/translateAuthError";
import { getFirstFieldError } from "./SignupForm.helpers";

/**
 * v13.312.19 — Ola 1 · PR-6 paso 2: migrado de 10 `useState` a RHF+zod.
 * El schema valida el match de contraseñas y el checkbox de términos.
 */
const signupSchema = z
  .object({
    name: z.string().min(1, "Ingresa tu nombre."),
    company: z
      .string()
      .trim()
      .min(2, "El nombre de la empresa debe tener entre 2 y 120 caracteres.")
      .max(120, "El nombre de la empresa debe tener entre 2 y 120 caracteres."),
    phone: z.string().optional(),
    email: z.string().email("Correo inválido."),
    password: passwordSchema,
    password2: passwordSchema,

    acceptTerms: z.literal(true, {
      message: "Debes aceptar los términos para continuar.",
    }),
  })
  .refine((v) => v.password === v.password2, {
    path: ["password2"],
    message: "Las contraseñas no coinciden.",
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { toast } = useToast();
  const [signupDone, setSignupDone] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      password: "",
      password2: "",
      // SAFE-CAST: `z.literal(true)` obliga a que el tipo del campo sea `true`,
      // pero el defaultValue del checkbox arranca en `false` hasta que el usuario lo marca.
      acceptTerms: false as unknown as true,
    },
  });

  const onSubmit = async (v: SignupValues) => {
    setSignupError(null);
    try {
      await signUpWithEmail({
        email: v.email,
        password: v.password,
        fullName: v.name,
        companyName: v.company.trim(),
        phone: v.phone?.trim() || undefined,
        redirectTo: `${window.location.origin}/onboarding`,
      });
      setSignupDone(true);
      toast({ title: "Cuenta creada", description: "Revisa tu correo para confirmar tu cuenta." });
    } catch (err) {
      const friendly = translateAuthError(err instanceof Error ? err.message : null);
      setSignupError(friendly);
      notifyError(undefined, {
        title: "No pudimos crear la cuenta",
        description: friendly,
        error: err,
        method: "HANDLE_SIGNUP",
      });
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

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const alertMessage = signupError ?? getFirstFieldError(errors);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {alertMessage && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nombre completo</Label>
        <Input id="signup-name" type="text" placeholder="Juan Pérez" autoComplete="name" {...register("name")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-company">Nombre de empresa</Label>
        <Input
          id="signup-company"
          type="text"
          placeholder="Mi Agencia Aduanal S.A. de C.V."
          autoComplete="organization"
          {...register("company")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-phone">
          Teléfono <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="signup-phone"
          type="tel"
          placeholder="55 1234 5678"
          autoComplete="tel"
          inputMode="tel"
          {...register("phone")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email de trabajo</Label>
        <Input id="signup-email" type="email" placeholder="tu@agencia.com" autoComplete="email" {...register("email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Contraseña</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          {...register("password")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password2">Confirmar contraseña</Label>
        <Input
          id="signup-password2"
          type="password"
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          {...register("password2")}
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <Checkbox
              className="mt-0.5"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
        <span>
          Acepto los{" "}
          <a href="/legal/terminos" target="_blank" className="text-accent hover:underline">
            Términos
          </a>{" "}
          y el{" "}
          <a href="/legal/privacidad" target="_blank" className="text-accent hover:underline">
            Aviso de privacidad
          </a>
          .
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Crear cuenta gratis
      </Button>
    </form>
  );
}
