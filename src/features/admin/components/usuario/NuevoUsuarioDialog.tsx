import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/shared";
import { Loader2, UserPlus } from "lucide-react";
import { useCreateUser } from "@/features/admin/hooks/usuario";
import { useOrganizationsList } from "@/features/admin/hooks";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import type { AppRole } from "@/types/appRole";
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
  const [touched, setTouched] = useState({ email: false, password: false });
  const { toast } = useToast();
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
    setTouched({ email: false, password: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || !password) return;
    if (!EMAIL_REGEX.test(email)) return;
    if (password.length < PASSWORD_MIN) {
      notifyError(toast, {
        title: "Error",
        description: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`,
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }
    if (showOrgSelector && !orgId) {
      notifyError(toast, {
        title: "Error",
        description: "Selecciona una organización",
        method: "HANDLE_SUBMIT",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }

    createUser.mutate(
      { email, password, role, orgId: showOrgSelector ? orgId : undefined },
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className={cn(dialogSize["2xl"], scrollableDialog)}>
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span>{showOrgSelector ? "Nuevo Usuario Global" : "Nuevo Usuario"}</span>
              <DialogDescription className="font-normal">
                {showOrgSelector
                  ? "Registra un usuario y asígnalo a una organización."
                  : "Registra un usuario para tu organización y asígnale un rol."}
              </DialogDescription>
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <NuevoUsuarioCredencialesSection
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

          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createUser.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                "Crear usuario"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
