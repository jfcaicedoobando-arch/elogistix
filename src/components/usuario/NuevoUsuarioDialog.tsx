import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// Input se usa dentro de NuevoUsuarioCredencialesSection.
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/shared";
import { Loader2, UserPlus, Building2, ShieldCheck } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { useCreateUser } from "@/hooks/usuario";
import { useOrganizationsList } from "@/features/admin/hooks";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { ASSIGNABLE_ROLES_ADMIN_ORG, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/features/admin/domain/roles/roleCatalog";
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

export default function NuevoUsuarioDialog({ open, onOpenChange, onCreated, showOrgSelector = false }: Props) {
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
    () => (touched.password && password && password.length < 6 ? "Mínimo 6 caracteres" : null),
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
    if (password.length < 6) {
      notifyError(toast, { title: "Error", description: "La contraseña debe tener al menos 6 caracteres", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    if (showOrgSelector && !orgId) {
      notifyError(toast, { title: "Error", description: "Selecciona una organización", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }

    createUser.mutate(
      { email, password, role, orgId: showOrgSelector ? orgId : undefined },
      {
        onSuccess: () => {
          notifySuccess(toast, { title: "Usuario creado", description: `Se registró ${email} como ${ROLE_LABELS[role]}` });
          reset();
          onOpenChange(false);
          onCreated();
        },
        onError: (err: unknown) => {
          notifyError(toast, { title: "Error", description: getErrorMessage(err), method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className={cn(dialogSize.md, scrollableDialog)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {showOrgSelector ? "Nuevo Usuario Global" : "Nuevo Usuario"}
          </DialogTitle>
          <DialogDescription>
            {showOrgSelector
              ? "Registra un usuario y asígnalo a una organización."
              : "Registra un usuario para tu organización y asígnale un rol."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Sección: Acceso */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceso</h4>

            {showOrgSelector && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Organización</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona organización" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {ASSIGNABLE_ROLES_ADMIN_ORG.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">{ROLE_LABELS[r]}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">{ROLE_DESCRIPTIONS[r]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createUser.isPending}>Cancelar</Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
