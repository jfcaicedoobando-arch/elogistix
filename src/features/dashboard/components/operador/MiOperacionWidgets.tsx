/**
 * Sub-componentes presentacionales de `MiOperacionSection`.
 * Extraídos para mantener el contenedor ≤200 líneas (Power of 10).
 */
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";

interface WidgetCardProps {
  icon: LucideIcon;
  title: string;
  count: number;
  empty: string;
  isLoading: boolean;
  iconClass: string;
  children: React.ReactNode;
}

export function WidgetCard({
  icon: Icon,
  title,
  count,
  empty: _empty,
  isLoading,
  iconClass,
  children,
}: WidgetCardProps) {
  if (!isLoading && count === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          {title}
          {!isLoading && count > 0 && (
            <Badge variant="secondary" className="ml-auto text-2xs">{count}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[260px] overflow-y-auto">
        {isLoading
          ? <ListSkeleton rows={3} />
          : children}
      </CardContent>
    </Card>
  );
}

interface RowProps {
  onClick: () => void;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
}

export function Row({ onClick, badge, badgeClass, title, subtitle }: RowProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div
        className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-md flex items-center justify-center text-xs font-bold text-primary-foreground ${badgeClass}`}
      >
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
