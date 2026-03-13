import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiCard({
  titulo, valor, subtitulo, icono: Icono, color, loading, children,
}: {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icono: React.ElementType;
  color: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    blue:    "bg-blue-50 text-blue-600",
    violet:  "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red:     "bg-red-50 text-red-600",
  };
  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-xl p-3 ${colorMap[color] ?? colorMap.blue}`}>
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
