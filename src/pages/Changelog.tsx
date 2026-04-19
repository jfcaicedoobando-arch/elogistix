import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  recentChangelog,
  loadLegacyChangelog,
  type ChangeType,
  type ChangelogEntry,
} from "@/data/changelogData";

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 20;

export default function Changelog() {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [legacy, setLegacy] = useState<ChangelogEntry[] | null>(null);
  const [loadingLegacy, setLoadingLegacy] = useState(false);

  const allEntries = useMemo(
    () => (legacy ? [...recentChangelog, ...legacy] : recentChangelog),
    [legacy],
  );

  const visibleEntries = useMemo(
    () => allEntries.slice(0, visibleCount),
    [allEntries, visibleCount],
  );

  const handleLoadMore = useCallback(async () => {
    // Si todavía hay items recientes sin mostrar, solo aumenta el contador.
    if (visibleCount < recentChangelog.length) {
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    // Si ya mostramos todo el reciente y aún no cargamos legacy, hacerlo.
    if (!legacy && !loadingLegacy) {
      setLoadingLegacy(true);
      const data = await loadLegacyChangelog();
      setLegacy(data);
      setLoadingLegacy(false);
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    setVisibleCount((c) => c + PAGE_SIZE);
  }, [visibleCount, legacy, loadingLegacy]);

  const totalKnown = legacy ? allEntries.length : recentChangelog.length;
  const hasMore = visibleCount < totalKnown || !legacy;
  const remaining = legacy
    ? Math.max(0, allEntries.length - visibleCount)
    : null;

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
            onClick={handleLoadMore}
            disabled={loadingLegacy}
          >
            {loadingLegacy
              ? "Cargando histórico…"
              : remaining !== null
              ? `Ver más (${remaining} restantes)`
              : "Ver más"}
          </Button>
        </div>
      )}
    </div>
  );
}
