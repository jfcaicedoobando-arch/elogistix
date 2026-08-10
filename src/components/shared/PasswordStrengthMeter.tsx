/**
 * Ola 8 · B2 — Medidor de fuerza de contraseña reutilizable.
 * Antes vivía embebido en el alta de usuarios; ahora lo comparten registro,
 * restablecimiento, cambio propio y alta por admin.
 */
import { useMemo } from "react";
import { evaluarFuerza } from "@/lib/passwords/generator";
import { PASSWORD_HINT } from "@/lib/passwords/policy";

const BAR_COLOR: Record<number, string> = {
  0: "bg-muted",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-info",
  4: "bg-success",
};

interface Props {
  password: string;
  /** Muestra la leyenda con los requisitos mínimos. */
  mostrarHint?: boolean;
}

export function PasswordStrengthMeter({ password, mostrarHint = true }: Props) {
  const fuerza = useMemo(() => evaluarFuerza(password), [password]);

  return (
    <div className="space-y-1" data-testid="password-strength">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full ${
              fuerza.score >= n ? BAR_COLOR[fuerza.score] : "bg-muted"
            }`}
          />
        ))}
      </div>
      {fuerza.label && (
        <p className="text-xs text-muted-foreground">
          Fuerza: <span className="font-medium">{fuerza.label}</span>
        </p>
      )}
      {mostrarHint && <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>}
    </div>
  );
}
