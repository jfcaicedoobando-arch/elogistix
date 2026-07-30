interface CambioCampo {
  campo: string;
  antes: unknown;
  despues: unknown;
}

interface Props {
  detalles: Record<string, unknown>;
}

/** Render compacto del JSON de bitácora: prioriza la lista de cambios campo a campo. */
export function ActividadDetalles({ detalles }: Props) {
  const cambios = (detalles as { cambios?: { embarque?: CambioCampo[] } }).cambios?.embarque;

  if (cambios && cambios.length > 0) {
    return (
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {cambios.slice(0, 6).map((c, i) => (
          <li key={`${c.campo}-${i}`}>
            <span className="font-medium">{c.campo}:</span>{" "}
            <span className="line-through opacity-70">{String(c.antes ?? "—")}</span>
            {" → "}
            <span className="text-foreground">{String(c.despues ?? "—")}</span>
          </li>
        ))}
        {cambios.length > 6 && <li className="italic">+{cambios.length - 6} cambios más</li>}
      </ul>
    );
  }

  const entries = Object.entries(detalles).filter(
    ([, v]) => v !== null && v !== "" && v !== undefined,
  );
  if (entries.length === 0) return null;

  return (
    <p className="mt-1 text-xs text-muted-foreground break-words">
      {entries
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join(" · ")}
    </p>
  );
}
