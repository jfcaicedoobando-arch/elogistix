/**
 * Estado del formulario de alta de usuario.
 * v13.821.7 — extraído de `NuevoUsuarioDialog` para respetar el límite de
 * 200 líneas por archivo productivo (Power of 10).
 */
import { useMemo, useState } from "react";
import type { AppRole } from "@/types/appRole";
import { PASSWORD_MIN } from "@/lib/passwords/policy";
import { esEmailValido } from "@/features/admin/components/usuario/emailUsuario";

export const DEFAULT_ROLE: AppRole = "customer_service";

export function useNuevoUsuarioForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<AppRole>(DEFAULT_ROLE);
  const [orgId, setOrgId] = useState("");
  // U-04: por defecto se invita por correo; el admin ya no tiene que inventar
  // y comunicar una contraseña temporal.
  const [porInvitacion, setPorInvitacion] = useState(true);
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailError = useMemo(
    () => (touched.email && email && !esEmailValido(email) ? "Correo no válido" : null),
    [email, touched.email],
  );
  const passwordError = useMemo(
    () =>
      touched.password && password && password.length < PASSWORD_MIN
        ? `Mínimo ${PASSWORD_MIN} caracteres`
        : null,
    [password, touched.password],
  );

  // Con datos capturados, cerrar pide confirmación en vez de descartar
  // credenciales en silencio.
  const isDirty =
    email.trim() !== "" ||
    password !== "" ||
    role !== DEFAULT_ROLE ||
    orgId !== "" ||
    !porInvitacion;

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole(DEFAULT_ROLE);
    setOrgId("");
    setPorInvitacion(true);
    setTouched({ email: false, password: false });
  };

  return {
    email, setEmail,
    password, setPassword,
    showPassword, setShowPassword,
    role, setRole,
    orgId, setOrgId,
    porInvitacion, setPorInvitacion,
    touched, setTouched,
    emailError, passwordError, isDirty, reset,
  };
}
