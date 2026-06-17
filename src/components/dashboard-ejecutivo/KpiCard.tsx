import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaVariant?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  onClick?: () => void;
}

export function KpiCard({ label, value, delta, deltaVariant = "neutral", icon: Icon, onClick }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "transition-shadow",
        onClick && "cursor-pointer hover:shadow-md",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-semibold tabular-nums truncate">{value}</p>
            {delta && (
              <p
                className={cn(
                  "text-xs tabular-nums",
                  deltaVariant === "positive" && "text-success",
                  deltaVariant === "negative" && "text-destructive",
                  deltaVariant === "neutral" && "text-muted-foreground",
                )}
              >
                {delta}
              </p>
            )}
          </div>
          {Icon && <Icon className="h-5 w-5 text-muted-foreground shrink-0" />}
        </div>
      </CardContent>
    </Card>
  );
}
