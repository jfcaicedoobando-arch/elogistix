import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface PortalCrumb {
  label: string;
  href: string;
}

interface Props {
  breadcrumbs: PortalCrumb[];
}

export function PortalBreadcrumbsBar({ breadcrumbs }: Props) {
  if (breadcrumbs.length <= 1) return null;
  return (
    <div className="border-b bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-1 text-xs text-muted-foreground">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="text-foreground font-medium">{crumb.label}</span>
            ) : (
              <Link to={crumb.href} className="hover:text-foreground transition-colors">{crumb.label}</Link>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
