import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CredencialesProps {
  email: string;
  password: string;
  showPassword: boolean;
  emailError: string | null;
  passwordError: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onToggleShowPassword: () => void;
  onEmailBlur: () => void;
  onPasswordBlur: () => void;
}

export function NuevoUsuarioCredencialesSection(props: CredencialesProps) {
  const {
    email, password, showPassword, emailError, passwordError,
    onEmailChange, onPasswordChange, onToggleShowPassword,
    onEmailBlur, onPasswordBlur,
  } = props;
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credenciales</h4>

      <div className="space-y-1.5">
        <Label htmlFor="nu-email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
        <Input
          id="nu-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          required
          placeholder="usuario@empresa.com"
          aria-invalid={!!emailError}
        />
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nu-password" className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Contraseña</Label>
        <div className="relative">
          <Input
            id="nu-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onBlur={onPasswordBlur}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            className="pr-10"
            aria-invalid={!!passwordError}
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordError
          ? <p className="text-xs text-destructive">{passwordError}</p>
          : <p className="text-xs text-muted-foreground">Mínimo 6 caracteres. El usuario podrá cambiarla después.</p>}
      </div>
    </section>
  );
}
