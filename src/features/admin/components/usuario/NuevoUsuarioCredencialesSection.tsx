import { useMemo } from "react";
import { Dice5, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { evaluarFuerza, generarPassword } from "@/lib/passwords/generator";

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

const BAR_COLOR: Record<number, string> = {
  0: "bg-muted",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-info",
  4: "bg-success",
};

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

  const fuerza = useMemo(() => evaluarFuerza(password), [password]);

  const handleGenerar = () => {
    const pw = generarPassword(14);
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
            minLength={8}
            maxLength={64}
            placeholder="Mínimo 8 caracteres"
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

        {/* Medidor de fuerza */}
        {password && (
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= fuerza.score ? BAR_COLOR[fuerza.score] : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground w-16 text-right">
              {fuerza.label}
            </span>
          </div>
        )}

        {passwordError ? (
          <p className="text-xs text-destructive">{passwordError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres. El usuario podrá cambiarla después.
          </p>
        )}
      </div>
      )}
    </section>
  );
}
