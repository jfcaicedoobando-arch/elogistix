/**
 * Subheader compacto del CRM (1 sola franja, h-10).
 * Reemplaza los `PageHeader` grandes en las pestañas internas para liberar
 * espacio vertical. Sólo muestra un contador/contexto a la derecha.
 */
interface Props {
  /** Texto chico a la derecha, ej. "127 leads · pipeline $4.2M". */
  context?: string;
  /** Acciones inline opcionales (botón secundario, menú "...", etc). */
  actions?: React.ReactNode;
}

export function CrmSubheader({ context, actions }: Props) {
  if (!context && !actions) return null;
  return (
    <div className="flex items-center justify-end gap-3 h-10 px-1 text-xs text-muted-foreground">
      {context && <span className="tabular-nums">{context}</span>}
      {actions}
    </div>
  );
}
