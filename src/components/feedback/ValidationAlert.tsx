import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type Severity = "error" | "warning" | "success";

interface Props {
  severity: Severity;
  /** Título opcional. Si se omite se usa uno por defecto según severidad. */
  title?: string;
  /** Diccionario de errores en formato { campo: "Campo: razón." } */
  errors?: Record<string, string>;
  /** Mensaje único, alternativo a `errors`. */
  message?: string;
  className?: string;
}

const DEFAULT_TITLES: Record<Severity, string> = {
  error: "Errores que impiden continuar",
  warning: "Advertencias",
  success: "Listo",
};

const VARIANT_MAP = {
  error: "destructive",
  warning: "warning",
  success: "success",
} as const;

const ICON_MAP = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
};

/**
 * Componente unificado para mostrar feedback de validación en formularios y wizards.
 * Garantiza el mismo estilo (icono, color, layout) para errores bloqueantes,
 * advertencias y éxitos en toda la aplicación.
 */
export function ValidationAlert({ severity, title, errors, message, className }: Props) {
  const list = errors ? Object.entries(errors) : [];
  if (!message && list.length === 0) return null;

  const Icon = ICON_MAP[severity];
  const variant = VARIANT_MAP[severity];
  const heading = title ?? DEFAULT_TITLES[severity];

  return (
    <Alert variant={variant} className={className}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{heading}</AlertTitle>
      <AlertDescription>
        {message && <div>{message}</div>}
        {list.length > 0 && (
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {list.map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
