import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  to?: string;
  tone?: "default" | "warning" | "danger" | "success";
  loading?: boolean;
}

const TONE_STYLES: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-border",
  warning: "border-amber-300 bg-amber-50/40",
  danger: "border-red-300 bg-red-50/40",
  success: "border-emerald-300 bg-emerald-50/40",
};

export function KpiTile({
  label,
  value,
  sublabel,
  icon,
  to,
  tone = "default",
  loading,
}: Props) {
  const inner = (
    <Card
      className={cn(
        "p-3 transition-shadow hover:shadow-md h-full",
        TONE_STYLES[tone],
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20 mt-1.5" />
      ) : (
        (() => {
          // v13.96.0 (auditoría mobile): tipografía adaptativa para evitar
          // "MXN 1,53…" truncado en pantallas angostas. Mismo criterio que KpiCard.
          const valorStr = String(value ?? "");
          const sizeClass =
            valorStr.length <= 8 ? "text-2xl sm:text-3xl"
            : valorStr.length <= 13 ? "text-xl sm:text-2xl"
            : "text-lg sm:text-xl";
          return (
            <p className={`${sizeClass} font-semibold tabular-nums mt-1 truncate`} title={valorStr}>
              {value}
            </p>
          );
        })()
      )}
      {sublabel && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{sublabel}</p>
      )}
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
        {inner}
      </Link>
    );
  }
  return inner;
}
