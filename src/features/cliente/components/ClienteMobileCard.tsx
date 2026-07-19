import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";
import type { ClienteRow } from "@/features/cliente/components/clientesTableConfig";

export function ClienteMobileCard({ c }: { c: ClienteRow }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="font-semibold text-sm truncate">{toTitleCase(c.nombre)}</div>
      <div className="text-label font-mono text-muted-foreground truncate">
        {(c.rfc || "—").toUpperCase()}
      </div>
      {(c.ciudad || c.estado) && (
        <div className="text-label text-muted-foreground truncate">
          {[correctSpanishPlace(c.ciudad), correctSpanishPlace(c.estado)]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}
      {(c.contacto || c.telefono) && (
        <div className="text-label text-muted-foreground truncate">
          {[toTitleCase(c.contacto), formatPhoneMx(c.telefono)].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
