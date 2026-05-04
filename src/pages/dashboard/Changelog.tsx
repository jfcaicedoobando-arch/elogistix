import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/shared/PageHeader";
import { Link2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  recentChangelog,
  loadChangelogMajor,
  loadLegacyChangelog,
  dedupeByVersion,
  type ChangeType,
  type ChangelogEntry,
} from "@/content/changelogData";

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 20;
type TypeFilter = "all" | ChangeType;

export default function Changelog() {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [v8Entries, setV8Entries] = useState<ChangelogEntry[] | null>(null);
  const [legacy, setLegacy] = useState<ChangelogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const targetRef = useRef<HTMLDivElement | null>(null);

  const allEntries = useMemo(() => {
    const parts: ChangelogEntry[] = [...recentChangelog];
    if (v8Entries) parts.push(...v8Entries);
    if (legacy) parts.push(...legacy);
    return dedupeByVersion(parts);
  }, [v8Entries, legacy]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEntries.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.summary?.toLowerCase().includes(q) ?? false) ||
        e.version.toLowerCase().includes(q)
      );
    });
  }, [allEntries, search, typeFilter]);

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount],
  );

  // Auto-cargar todo si hay filtros activos para que la búsqueda sea global.
  useEffect(() => {
    const hasFilter = search.trim() !== "" || typeFilter !== "all";
    if (!hasFilter) return;
    if (!v8Entries && !loading) {
      setLoading(true);
      loadChangelogMajor(8).then((d) => {
        setV8Entries(d);
        setLoading(false);
      });
    }
  }, [search, typeFilter, v8Entries, loading]);

  // Soporte de anclas profundas: /changelog#v8.104.0
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !hash.startsWith("v")) return;
    const version = hash.slice(1);
    const exists = allEntries.some((e) => e.version === version);
    if (!exists) {
      // Cargar todo y reintentar
      if (!v8Entries && !loading) {
        setLoading(true);
        Promise.all([loadChangelogMajor(8), loadLegacyChangelog()]).then(([v8, lg]) => {
          setV8Entries(v8);
          setLegacy(lg);
          setLoading(false);
        });
      }
      return;
    }
    // Asegurar que esté visible
    const idx = filteredEntries.findIndex((e) => e.version === version);
    if (idx >= visibleCount) setVisibleCount(idx + 1);
    setExpanded((prev) => ({ ...prev, [version]: true }));
    requestAnimationFrame(() => {
      const el = document.getElementById(`v${version}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [allEntries, filteredEntries, visibleCount, v8Entries, loading]);

  const handleLoadMore = useCallback(async () => {
    if (visibleCount < recentChangelog.length) {
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    if (!v8Entries && !loading) {
      setLoading(true);
      const data = await loadChangelogMajor(8);
      setV8Entries(data);
      setLoading(false);
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
    if (v8Entries && visibleCount < dedupeByVersion([...recentChangelog, ...v8Entries]).length) {
      setVisibleCount((c) => c + PAGE_SIZE);
      return;
    }
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

  const handleCopyLink = useCallback((version: string) => {
    const url = `${window.location.origin}${window.location.pathname}#v${version}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Enlace copiado", description: `v${version}` });
    });
  }, []);

  const toggleExpand = useCallback((version: string) => {
    setExpanded((prev) => ({ ...prev, [version]: !prev[version] }));
  }, []);

  const knownTotal = filteredEntries.length;
  const hasMore = visibleCount < knownTotal || (!legacy && search.trim() === "" && typeFilter === "all");
  const remaining = legacy ? Math.max(0, knownTotal - visibleCount) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Changelog"
        description="Historial de cambios y nuevas funcionalidades de la plataforma."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          placeholder="Buscar por título, versión o contenido…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="sm:max-w-sm"
        />
        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={(v) => {
            if (v) {
              setTypeFilter(v as TypeFilter);
              setVisibleCount(PAGE_SIZE);
            }
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="all">Todos</ToggleGroupItem>
          <ToggleGroupItem value="major">Major</ToggleGroupItem>
          <ToggleGroupItem value="minor">Minor</ToggleGroupItem>
          <ToggleGroupItem value="patch">Patch</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredEntries.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay resultados para los filtros aplicados.
        </p>
      )}

      <div ref={targetRef} className="relative border-l-2 border-border ml-4 space-y-6 pl-8">
        {visibleEntries.map((entry) => {
          const config = typeConfig[entry.type];
          const isExpanded = expanded[entry.version] ?? false;
          const summary = entry.summary ?? entry.description;
          const hasDetails = entry.summary && entry.description !== entry.summary;
          return (
            <div key={entry.version} id={`v${entry.version}`} className="relative scroll-mt-20">
              <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm">v{entry.version}</span>
                    <Badge className={config.className}>{config.label}</Badge>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(entry.version)}
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
                      {isExpanded && (
                        <p className="text-sm text-muted-foreground leading-relaxed pt-1 border-t border-border/50 mt-2 pt-2">
                          {entry.description}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry.version)}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        {isExpanded ? (
                          <>
                            Ocultar detalles <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Ver detalles técnicos <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    </>
                  )}
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
