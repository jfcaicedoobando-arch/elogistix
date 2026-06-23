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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/shared";
import { Building2, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useCreateUser } from "@/features/admin/hooks/usuario";
import { useOrganizationsList } from "@/features/admin/hooks";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import {
  ASSIGNABLE_ROLE_GROUPS,
  ROLE_BADGE_CLASSES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/features/admin/domain/roles/roleCatalog";
import type { AppRole } from "@/types/appRole";
import { NuevoUsuarioCredencialesSection } from "./NuevoUsuarioCredencialesSection";

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

            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acceso
              </h4>

              {showOrgSelector && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Organización
                  </Label>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona organización" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Rol
                </Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    {/* SelectValue con render plano para evitar desborde vertical */}
                    <SelectValue>{ROLE_LABELS[role]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-96 w-[var(--radix-select-trigger-width)]">
                    {ASSIGNABLE_ROLE_GROUPS.map((group, gi) => (
                      <div key={group.label}>
                        {gi > 0 && <SelectSeparator />}
                        <SelectGroup>
                          <SelectLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </SelectLabel>
                          {group.roles.map((r) => (
                            <SelectItem key={r} value={r}>
                              <div className="flex flex-col py-0.5">
                                <span className="font-medium">{ROLE_LABELS[r]}</span>
                                <span className="text-xs text-muted-foreground line-clamp-2">
                                  {ROLE_DESCRIPTIONS[r]}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vista previa del rol seleccionado */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Badge className={`${ROLE_BADGE_CLASSES[role]} whitespace-nowrap`}>
                  {ROLE_LABELS[role]}
                </Badge>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            </section>
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
