import { ErrorStateInline } from "@/components/empty/ErrorStateInline";

interface Props {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  hasPreviousData?: boolean;
}

/** Una consulta fallida nunca equivale a cartera vacía ni a importes vigentes. */
export function FinancialQueryError({ title, error, onRetry, retrying, hasPreviousData }: Props) {
  const truncated = typeof error === "object" && error !== null &&
    "code" in error && error.code === "LC_RESULTADO_TRUNCADO";
  const reason = truncated
    ? "La consulta puede estar incompleta. No se pueden usar importes parciales. Si persiste, contacta a soporte."
    : "No se pudo completar la consulta. Revisa tu conexión e intenta de nuevo.";

  return (
    <ErrorStateInline
      title={title}
      message={hasPreviousData ? `Los datos mostrados son de la última consulta correcta y no están actualizados. ${reason}` : reason}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}
