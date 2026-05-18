import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChangelogEntryCard } from "@/components/dashboard/ChangelogEntryCard";
import { useChangelogController } from "@/hooks/dashboard";

export default function Changelog() {
  const {
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
  } = useChangelogController();

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
          onChange={(e) => handleSearchChange(e.target.value)}
          className="sm:max-w-sm"
        />
        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={handleTypeFilterChange}
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

      <div className="relative border-l-2 border-border ml-4 space-y-6 pl-8">
        {visibleEntries.map((entry) => (
          <ChangelogEntryCard
            key={entry.version}
            entry={entry}
            expanded={expanded[entry.version] ?? false}
            onCopyLink={handleCopyLink}
            onToggleExpand={toggleExpand}
          />
        ))}
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
