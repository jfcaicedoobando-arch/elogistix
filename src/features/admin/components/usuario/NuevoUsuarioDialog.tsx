import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogCancelarBoton } from "@/components/shared/FormDialogCancelarBoton";
import { useCreateUser } from "@/features/admin/hooks/usuario";
import { useOrganizationsList } from "@/features/admin/hooks";
import { notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NuevoUsuarioCredencialesSection } from "./NuevoUsuarioCredencialesSection";
import { NuevoUsuarioAccesoSection } from "./NuevoUsuarioAccesoSection";
import { PASSWORD_MIN } from "@/lib/passwords/policy";
import { normalizarEmail, esEmailValido } from "./emailUsuario";
import { useNuevoUsuarioForm, DEFAULT_ROLE } from "./useNuevoUsuarioForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  showOrgSelector?: boolean;
}




export default function NuevoUsuarioDialog({
  open,
  onOpenChange,
  onCreated,
  showOrgSelector = false,
}: Props) {
  const {
    email, setEmail, password, setPassword, showPassword, setShowPassword,
    role, setRole, orgId, setOrgId, porInvitacion, setPorInvitacion,
    touched, setTouched, emailError, passwordError, isDirty, reset,
  } = useNuevoUsuarioForm();
  const createUser = useCreateUser();
  const { data: orgs = [] } = useOrganizationsList(open && showOrgSelector);

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    const emailNormalizado = normalizarEmail(email);
    if (!emailNormalizado) return;
    if (!esEmailValido(emailNormalizado)) return;
    if (!porInvitacion && password.length < PASSWORD_MIN) {
      notifyError(undefined, {
        title: "Error",
        description: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`,
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    if (showOrgSelector && !orgId) {
      notifyError(undefined, {
        title: "Error",
        description: "Selecciona una organización",
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }

    createUser.mutate(
      {
        email: emailNormalizado,
        password: porInvitacion ? undefined : password,
        role,
        orgId: showOrgSelector ? orgId : undefined,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
          onCreated();
        },
      },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      icon={UserPlus}
      title={showOrgSelector ? "Nuevo Usuario Global" : "Nuevo Usuario"}
      description={
        showOrgSelector
          ? "Registra un usuario y asígnalo a una organización."
          : "Registra un usuario para tu organización y asígnale un rol."
      }
      size="2xl"
      isDirty={isDirty}
      footer={
        <>
          <FormDialogCancelarBoton
            onCancelar={() => onOpenChange(false)}
            disabled={createUser.isPending}
          />
          {/* Ola 13 · R4UX-03: convención UX-11 — prop `loading` del Button del
              DS (deshabilita, pone `aria-busy` y pinta el spinner). */}
          <Button onClick={handleSubmit} loading={createUser.isPending}>
            {createUser.isPending
              ? porInvitacion
                ? "Enviando…"
                : "Creando…"
              : porInvitacion
                ? "Enviar invitación"
                : "Crear usuario"}
          </Button>
        </>
      }
    >
      <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/30 p-3">
        <div className="space-y-0.5">
          <Label htmlFor="por-invitacion" className="text-body font-medium">
            Invitar por correo
          </Label>
          <p className="text-body-sm text-muted-foreground">
            El usuario recibe un correo para definir su propia contraseña. Desactívalo sólo si
            necesitas entregarle una contraseña temporal.
          </p>
        </div>
        <Switch
          id="por-invitacion"
          checked={porInvitacion}
          onCheckedChange={setPorInvitacion}
        />
      </div>

      {/* Con invitación por correo la columna de credenciales sólo tiene el email:
          usar una sola columna evita el hueco vacío a 1366×768. */}
      <div className={porInvitacion ? "grid gap-5" : "grid gap-5 md:grid-cols-2"}>

        <NuevoUsuarioCredencialesSection
          ocultarPassword={porInvitacion}
          email={email}
          password={password}
          showPassword={showPassword}
          emailError={emailError}
          passwordError={passwordError}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onToggleShowPassword={() => setShowPassword((v) => !v)}
          onEmailBlur={() => setTouched((t) => ({ ...t, email: true }))}
          onPasswordBlur={() => setTouched((t) => ({ ...t, password: true }))}
        />

        <NuevoUsuarioAccesoSection
          role={role}
          onRoleChange={setRole}
          showOrgSelector={showOrgSelector}
          orgId={orgId}
          onOrgIdChange={setOrgId}
          orgs={orgs}
        />
      </div>
    </FormDialogShell>
  );
}
