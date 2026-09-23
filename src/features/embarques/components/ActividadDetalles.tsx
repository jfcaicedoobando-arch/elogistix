import { detallesLegibles } from "@/features/embarques/domain/actividadHumana";
import { etiquetaCampo } from "@/features/embarques/domain/actividadDescripcion";


interface CambioCampo {
  campo: string;
  antes: unknown;
  despues: unknown;
}

interface Props {
  detalles: Record<string, unknown>;
}

/** Disclosure accesible con el JSON completo: la auditoría no se pierde. */
function DetalleTecnico({ detalles }: Props) {
  return (
    <details className="mt-1 text-body-sm text-muted-foreground">
      <summary className="cursor-pointer underline decoration-dotted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
        Ver detalle técnico
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-2xs whitespace-pre-wrap break-words">
        {JSON.stringify(detalles, null, 2)}
      </pre>
    </details>
  );
}

/**
 * Render humano del JSON de bitácora: cambios campo a campo o pares legibles.
 * P2-2: los UUID y objetos anidados sólo viven en el disclosure técnico.
 */
export function ActividadDetalles({ detalles }: Props) {
  const cambios = (detalles as { cambios?: { embarque?: CambioCampo[] } }).cambios?.embarque;

  if (cambios && cambios.length > 0) {
    return (
      <>
        <ul className="mt-1 space-y-0.5 text-body-sm text-muted-foreground">
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
        <DetalleTecnico detalles={detalles} />
      </>
    );
  }

  const pares = detallesLegibles(detalles);

  return (
    <>
      {pares.length > 0 && (
        <p className="mt-1 text-body-sm text-muted-foreground break-words">
          {pares.slice(0, 4).map(([label, valor]) => `${label}: ${valor}`).join(" · ")}
        </p>
      )}
      <DetalleTecnico detalles={detalles} />
    </>
  );
}
