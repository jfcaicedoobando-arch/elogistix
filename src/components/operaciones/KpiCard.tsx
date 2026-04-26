import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { kpiIconChipClasses, type KpiTone } from "@/lib/ui/kpiTones";

export function KpiCard({
  titulo, valor, subtitulo, icono: Icono, color, loading, children,
}: {
  titulo: string;
  valor: string | number;
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
  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-xl p-3 ${kpiIconChipClasses(tone)}`}>
          <Icono className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{titulo}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">{valor}</p>
              {subtitulo && <p className="text-[10px] text-muted-foreground">{subtitulo}</p>}
            </>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
