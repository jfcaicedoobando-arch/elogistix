import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCreateUser } from "@/features/admin/hooks/usuario";
import { useOrganizationsList } from "@/features/admin/hooks";
import { notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { AppRole } from "@/types/appRole";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NuevoUsuarioCredencialesSection } from "./NuevoUsuarioCredencialesSection";
import { NuevoUsuarioAccesoSection } from "./NuevoUsuarioAccesoSection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  showOrgSelector?: boolean;
}

const DEFAULT_ROLE: AppRole = "customer_service";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

export default function NuevoUsuarioDialog({
  open,
  onOpenChange,
  onCreated,
  showOrgSelector = false,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<AppRole>(DEFAULT_ROLE);
  const [orgId, setOrgId] = useState("");
  // U-04: por defecto se invita por correo; el admin ya no tiene que inventar
  // y comunicar una contraseña temporal.
  const [porInvitacion, setPorInvitacion] = useState(true);
  const [touched, setTouched] = useState({ email: false, password: false });
  const createUser = useCreateUser();

  const { data: orgs = [] } = useOrganizationsList(open && showOrgSelector);

  const emailError = useMemo(
    () => (touched.email && email && !EMAIL_REGEX.test(email) ? "Email no válido" : null),
    [email, touched.email],
  );
  const passwordError = useMemo(
    () =>
      touched.password && password && password.length < PASSWORD_MIN
        ? `Mínimo ${PASSWORD_MIN} caracteres`
        : null,
    [password, touched.password],
  );

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole(DEFAULT_ROLE);
    setOrgId("");
    setPorInvitacion(true);
    setTouched({ email: false, password: false });
  };

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) return;
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
        email,
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
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createUser.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createUser.isPending}>
            {createUser.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {porInvitacion ? "Enviando…" : "Creando…"}
              </>
            ) : porInvitacion ? (
              "Enviar invitación"
            ) : (
              "Crear usuario"
            )}
          </Button>
        </>
      }
    >
      <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/30 p-3">
        <div className="space-y-0.5">
          <Label htmlFor="por-invitacion" className="text-sm font-medium">
            Invitar por correo
          </Label>
          <p className="text-xs text-muted-foreground">
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

      <div className="grid gap-5 md:grid-cols-2">
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
