import { Dice5, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generarPassword } from "@/lib/passwords/generator";
// Ola 8 · B2: política y medidor compartidos con registro/reset/cambio propio.
import { PASSWORD_MIN, PASSWORD_MAX, PASSWORD_SUGERIDA } from "@/lib/passwords/policy";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";

interface CredencialesProps {
  /** U-04: en alta por invitación no se pide contraseña. */
  ocultarPassword?: boolean;
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
    ocultarPassword = false,
    email,
    password,
    showPassword,
    emailError,
    passwordError,
    onEmailChange,
    onPasswordChange,
    onToggleShowPassword,
    onEmailBlur,
    onPasswordBlur,
  } = props;

  const handleGenerar = () => {
    const pw = generarPassword(PASSWORD_SUGERIDA);
    onPasswordChange(pw);
  };

  return (
    <section className="space-y-3">
      <h4 className="text-overline font-semibold">
        Credenciales
      </h4>

      <div className="space-y-1.5">
        <Label htmlFor="nu-email" className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Email
        </Label>
        <Input
          id="nu-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          required
          maxLength={255}
          autoFocus
          placeholder="usuario@empresa.com"
          aria-invalid={!!emailError}
        />
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      {ocultarPassword ? null : (
      <div className="space-y-1.5">
        <Label htmlFor="nu-password" className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Contraseña
        </Label>
        <div className="relative">
          <Input
            id="nu-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onBlur={onPasswordBlur}
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
            className="pr-20"
            aria-invalid={!!passwordError}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleGenerar}
                  aria-label="Generar contraseña fuerte"
                >
                  <Dice5 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Generar contraseña fuerte</p>
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onToggleShowPassword}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <PasswordStrengthMeter password={password} mostrarHint={false} />

        {passwordError ? (
          <p className="text-xs text-destructive">{passwordError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Mínimo {PASSWORD_MIN} caracteres. El usuario podrá cambiarla después.
          </p>
        )}
      </div>
      )}
    </section>
  );
}
