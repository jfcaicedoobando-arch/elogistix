import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, ChevronDown, ChevronUp } from "lucide-react";
import type { ChangeType, ChangelogEntry } from "@/content/changelogData";

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

interface Props {
  entry: ChangelogEntry;
  expanded: boolean;
  onCopyLink: (version: string) => void;
  onToggleExpand: (version: string) => void;
}

export function ChangelogEntryCard({ entry, expanded, onCopyLink, onToggleExpand }: Props) {
  const config = typeConfig[entry.type];
  const summary = entry.summary ?? entry.description;
  const hasDetails = entry.summary && entry.description !== entry.summary;

  return (
    <div id={`v${entry.version}`} className="relative scroll-mt-20">
      <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
      <Card>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-sm">v{entry.version}</span>
            <Badge className={config.className}>{config.label}</Badge>
            <button
              type="button"
              onClick={() => onCopyLink(entry.version)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copiar enlace"
              title="Copiar enlace"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground ml-auto">{entry.date}</span>
          </div>
          <h3 className="font-semibold">{entry.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
          {hasDetails && (
            <>
              {expanded && (
                <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/50 mt-2 pt-2">
                  {entry.description}
                </p>
              )}
              <button
                type="button"
                onClick={() => onToggleExpand(entry.version)}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                {expanded ? (
                  <>Ocultar detalles <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Ver detalles técnicos <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
