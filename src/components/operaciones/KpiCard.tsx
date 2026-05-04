import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { kpiIconChipClasses, type KpiTone } from "@/lib/ui/kpiTones";

/**
 * KpiCard — tarjeta de métrica unificada del sistema.
 *
 * v8.99.28: tipografía adaptativa según longitud del valor (text-3xl → text-xl
 * para evitar overflow tipo "USD 92,789.8…"), tabular-nums para alineación
 * numérica entre cards, subtítulo a text-xs y truncate con tooltip nativo.
 */
export function KpiCard({
  titulo, valor, valorTooltip, subtitulo, icono: Icono, color, loading, children,
}: {
  titulo: string;
  valor: string | number;
  /** Tooltip opcional sobre el valor — útil cuando `valor` viene formateado en notación compacta
   *  (p.ej. "USD 1.2M") y se quiere exponer el valor completo (p.ej. "USD 1,234,567.89") al hover. */
  valorTooltip?: string;
  subtitulo?: string;
  icono: React.ElementType;
  /** Tono categórico del icono. Acepta KpiTone o aliases legacy. */
  color: KpiTone | "blue" | "violet" | "emerald" | "red";
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const aliasMap: Record<string, KpiTone> = {
    blue: "info",
    violet: "accent",
    emerald: "success",
    red: "danger",
  };
  const tone: KpiTone = (aliasMap[color] ?? color) as KpiTone;

  // Tipografía adaptativa para evitar overflow visible:
  //  - Valores cortos (≤8 chars como "1,234" o "85%") → text-3xl, denso y legible.
  //  - Valores medios (9-13 chars como "USD 12,500") → text-2xl.
  //  - Valores largos (14+ chars como "USD 1,234,567.89") → text-xl, evita "…".
  const valorStr = String(valor ?? "");
  const sizeClass =
    valorStr.length <= 8 ? "text-3xl"
    : valorStr.length <= 13 ? "text-2xl"
    : valorStr.length <= 18 ? "text-xl"
    : "text-lg";

  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
        <div className={`rounded-xl p-2.5 sm:p-3 shrink-0 ${kpiIconChipClasses(tone)}`}>
          <Icono className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate" title={titulo}>{titulo}</p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-1" />
          ) : (
            <>
              <p
                className={`${sizeClass} font-bold text-foreground tabular-nums leading-tight truncate`}
                title={valorTooltip ?? valorStr}
              >
                {valor}
              </p>
              {subtitulo && (
                <p className="text-xs text-muted-foreground truncate mt-0.5" title={subtitulo}>
                  {subtitulo}
                </p>
              )}
            </>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
