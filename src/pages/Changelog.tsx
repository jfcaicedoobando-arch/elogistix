import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { changelog, type ChangeType } from "@/data/changelogData";

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 20;

export default function Changelog() {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleEntries = useMemo(
    () => changelog.slice(0, visibleCount),
    [visibleCount],
  );
  const hasMore = visibleCount < changelog.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historial de cambios y nuevas funcionalidades de la plataforma.
        </p>
      </div>

      <div className="relative border-l-2 border-border ml-4 space-y-6 pl-8">
        {visibleEntries.map((entry) => {
          const config = typeConfig[entry.type];
          return (
            <div key={entry.version} className="relative">
              <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm">v{entry.version}</span>
                    <Badge className={config.className}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{entry.date}</span>
                  </div>
                  <h3 className="font-semibold">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Ver más ({changelog.length - visibleCount} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}
