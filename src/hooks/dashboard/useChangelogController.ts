import { useState, useMemo, useCallback, useEffect } from "react";
import {
  recentChangelog,
  loadChangelogMajor,
  loadLegacyChangelog,
  dedupeByVersion,
  type ChangeType,
  type ChangelogEntry,
} from "@/content/changelogData";
import { toast } from "@/hooks/use-toast";

export const PAGE_SIZE = 20;
export type TypeFilter = "all" | ChangeType;

export function useChangelogController() {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [v8Entries, setV8Entries] = useState<ChangelogEntry[] | null>(null);
  const [legacy, setLegacy] = useState<ChangelogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  // Auto-cargar todo si hay filtros activos.
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

  // Anclas profundas: /changelog#v8.104.0
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !hash.startsWith("v")) return;
    const version = hash.slice(1);
    const exists = allEntries.some((e) => e.version === version);
    if (!exists) {
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

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleTypeFilterChange = useCallback((value: string) => {
    if (!value) return;
    setTypeFilter(value as TypeFilter);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const knownTotal = filteredEntries.length;
  const hasMore =
    visibleCount < knownTotal || (!legacy && search.trim() === "" && typeFilter === "all");
  const remaining = legacy ? Math.max(0, knownTotal - visibleCount) : null;

  return {
    search,
    typeFilter,
    expanded,
    visibleEntries,
    filteredEntries,
    loading,
    hasMore,
    remaining,
    handleSearchChange,
    handleTypeFilterChange,
    handleLoadMore,
    handleCopyLink,
    toggleExpand,
  };
}
