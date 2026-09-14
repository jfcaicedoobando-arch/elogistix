/** Aviso breve cuando el estado de la cotización ya no permite editar costos. */
export function AvisoCostosBloqueados({
  motivo,
  visible,
}: {
  motivo: string | null;
  visible: boolean;
}) {
  if (!motivo || !visible) return null;
  return <p className="text-body-sm text-muted-foreground">{motivo}</p>;
}
