/** Estado y validación del formulario de alta; conserva la API de sus controles. */
import { useState, type SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AppRole } from "@/types/appRole";
import { Constants } from "@/integrations/supabase/types";
import { PASSWORD_MIN } from "@/lib/passwords/policy";
import { esEmailValido, normalizarEmail } from "@/features/admin/components/usuario/emailUsuario";

export const DEFAULT_ROLE: AppRole = "customer_service";

const schema = z.object({
  email: z.string().transform(normalizarEmail).refine(esEmailValido, "Correo no válido"),
  password: z.string(),
  role: z.enum(Constants.public.Enums.app_role),
  orgId: z.string(),
  porInvitacion: z.boolean(),
}).superRefine(({ password, porInvitacion }, ctx) => {
  if (!porInvitacion && password.length < PASSWORD_MIN) {
    ctx.addIssue({ code: "custom", path: ["password"], message: `Mínimo ${PASSWORD_MIN} caracteres` });
  }
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type Touched = { email: boolean; password: boolean };
const defaultValues: FormInput = {
  email: "", password: "", role: DEFAULT_ROLE, orgId: "", porInvitacion: true,
};

function nextValue<T extends string | boolean>(action: SetStateAction<T>, current: T): T {
  return typeof action === "function" ? action(current) : action;
}

export function useNuevoUsuarioForm() {
  const [showPassword, setShowPassword] = useState(false);
  const {
    control, setValue, getValues, getFieldState, reset: resetForm, handleSubmit,
    formState: { errors, touchedFields, dirtyFields, isDirty: formIsDirty },
  } = useForm<FormInput, undefined, FormOutput>({
    resolver: zodResolver(schema), defaultValues, mode: "onBlur",
  });
  const [email, password, role, orgId, porInvitacion] = useWatch({
    control, name: ["email", "password", "role", "orgId", "porInvitacion"],
  });
  const touched: Touched = {
    email: Boolean(touchedFields.email), password: Boolean(touchedFields.password),
  };
  const changeOptions = (name: keyof FormInput) => ({
    shouldDirty: true, shouldValidate: getFieldState(name).isTouched,
  });
  const setEmail = (value: SetStateAction<string>) =>
    setValue("email", nextValue(value, getValues("email")), changeOptions("email"));
  const setPassword = (value: SetStateAction<string>) =>
    setValue("password", nextValue(value, getValues("password")), changeOptions("password"));
  const setRole = (value: SetStateAction<AppRole>) =>
    setValue("role", nextValue(value, getValues("role")), changeOptions("role"));
  const setOrgId = (value: SetStateAction<string>) =>
    setValue("orgId", nextValue(value, getValues("orgId")), changeOptions("orgId"));
  const setPorInvitacion = (value: SetStateAction<boolean>) => {
    setValue("porInvitacion", nextValue(value, getValues("porInvitacion")), { shouldDirty: true });
    // La contraseña puede haber sido visitada antes de cambiar el modo.
    if (getFieldState("password").isTouched) {
      setValue("password", getValues("password"), { shouldValidate: true });
    }
  };
  const setTouched = (action: SetStateAction<Touched>) => {
    const previous: Touched = {
      email: getFieldState("email").isTouched, password: getFieldState("password").isTouched,
    };
    const next = typeof action === "function" ? action(previous) : action;
    if ((previous.email && !next.email) || (previous.password && !next.password)) {
      resetForm(undefined, {
        keepValues: true, keepDefaultValues: true, keepErrors: true, keepDirty: true,
        keepIsValid: true, keepIsSubmitted: true, keepSubmitCount: true,
      });
    }
    if (next.email) setValue("email", getValues("email"), { shouldTouch: true, shouldValidate: true });
    if (next.password) setValue("password", getValues("password"), { shouldTouch: true, shouldValidate: true });
  };
  // Conserva el cierre sin aviso cuando sólo se capturaron espacios en el correo.
  const isDirty = formIsDirty && (
    email.trim() !== "" || Object.keys(dirtyFields).some((name) => name !== "email")
  );
  const emailError = touched.email && email ? errors.email?.message ?? null : null;
  const passwordError = touched.password && password ? errors.password?.message ?? null : null;
  const reset = () => {
    resetForm(defaultValues);
    setShowPassword(false);
  };

  return {
    email, setEmail, password, setPassword, showPassword, setShowPassword,
    role, setRole, orgId, setOrgId, porInvitacion, setPorInvitacion,
    touched, setTouched, emailError, passwordError, isDirty, reset,
    submit: handleSubmit,
  };
}
