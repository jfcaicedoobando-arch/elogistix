/**
 * Subcomponente presentacional: tarjeta del checklist de validaciones de cierre.
 * Extraído de `TabCierre.tsx` (Auditoría arquitectónica 13.56.6 / paso 15).
 *
 * v13.89.2 — Cada item es ahora un `CierreCheckItem` con deep-link al tab
 * correspondiente del embarque. La prop `etiquetas` se conserva por
 * compatibilidad pero ya no se usa (los labels viven en `cierreCheckMeta`).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CierreCheckItem } from "./CierreCheckItem";

export interface CierreCheck {
  regla: string;
  ok: boolean;
  detalle?: unknown;
}

interface Props {
  isLoading: boolean;
  checks: CierreCheck[];
  embarqueId: string;
  /** @deprecated — los labels están en `cierreCheckMeta`. Se acepta para no romper consumidores. */
  etiquetas?: Record<string, string>;
}

export function CierreChecklistCard({ isLoading, checks, embarqueId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist de cierre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Validando…</p>}
        {!isLoading && checks.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        )}
        <ul className="space-y-2">
          {checks.map((c) => (
            <CierreCheckItem
              key={c.regla}
              regla={c.regla}
              ok={c.ok}
              detalle={c.detalle}
              embarqueId={embarqueId}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
