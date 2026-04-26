import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  recentChangelog,
  loadChangelogV8,
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
  const [v8Entries, setV8Entries] = useState<ChangelogEntry[] | null>(null);
  const [legacy, setLegacy] = useState<ChangelogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const allEntries = useMemo(() => {
    const parts: ChangelogEntry[] = [...recentChangelog];
    if (v8Entries) parts.push(...v8Entries);
    if (legacy) parts.push(...legacy);
    return parts;
  }, [v8Entries, legacy]);

  const visibleEntries = useMemo(
    () => allEntries.slice(0, visibleCount),
    [allEntries, visibleCount],
  );

  const handleLoadMore = useCallback(async () => {
    // 1) Si aún hay items recientes sin mostrar, sólo aumenta contador.
    if (visibleCount < recentChangelog.length) {
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    // 2) Cargar v8 si aún no está.
    if (!v8Entries && !loading) {
      setLoading(true);
      const data = await loadChangelogV8();
      setV8Entries(data);
      setLoading(false);
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    // 3) Si v8 ya cargó pero faltan items por mostrar, sólo aumenta contador.
    if (v8Entries && visibleCount < recentChangelog.length + v8Entries.length) {
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    // 4) Cargar legacy si aún no está.
    if (!legacy && !loading) {
      setLoading(true);
      const data = await loadLegacyChangelog();
      setLegacy(data);
      setLoading(false);
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    setVisibleCount((c) => c + PAGE_SIZE);
  }, [visibleCount, v8Entries, legacy, loading]);

  const knownTotal = allEntries.length;
  // Hasta cargar legacy, no sabemos el total real → mostramos botón siempre.
  const hasMore = visibleCount < knownTotal || !legacy;
  const remaining = legacy ? Math.max(0, knownTotal - visibleCount) : null;

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
          <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
            {loading
              ? "Cargando…"
              : remaining !== null
              ? `Ver más (${remaining} restantes)`
              : "Ver más"}
          </Button>
        </div>
      )}
    </div>
  );
}
