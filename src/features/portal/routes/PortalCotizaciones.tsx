import { LoadingState } from "@/components/shared/states/LoadingState";
import { usePortalCotizaciones, usePortalClientUsers } from "@/features/portal/hooks";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SolicitarCotizacionDialog } from "@/features/portal/components/SolicitarCotizacionDialog";
import EmptyState from "@/components/empty/EmptyState";
import { PortalPageShell } from "@/features/portal/components/layout/PortalPageShell";
import { PortalFiltersBar } from "@/features/portal/components/filtros/PortalFiltersBar";
import { PortalCotizacionesMobileFilters } from "@/features/portal/components/PortalCotizacionesMobileFilters";
import {
  PortalCotizacionCard,
  type PortalCotizacionCardRow,
} from "@/features/portal/components/PortalCotizacionCard";
import { useState, useMemo } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { PORTAL_COTIZACION_ESTADOS_VISIBLES } from "@/features/portal/services/queries";
import { useDocumentTitle } from "@/hooks/shared";
import { opcionesSolicitante } from "@/features/portal/domain/clientesSolicitantes";

export default function PortalCotizaciones() {
  useDocumentTitle('Mis Cotizaciones');
  const { data: clientUsers = [] } = usePortalClientUsers();
  // Opciones autorizadas con nombre legible: la solicitud ya no se atribuye
  // en silencio al primer cliente del usuario.
  const clientes = useMemo(() => opcionesSolicitante(clientUsers), [clientUsers]);
  const clienteIds = useMemo(() => clientes.map((c) => c.id), [clientes]);
  const {
    data: cotizaciones = [], isLoading, isError, refetch,
  } = usePortalCotizaciones(clienteIds);
  const tasaIva = useTasaIVA();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [solicitudAbierta, setSolicitudAbierta] = useState(false);

  // v13.339.0 (Q-01): el filtro lista SIEMPRE los estados visibles para el
  // cliente (antes se derivaba de los datos y salía vacío sin cotizaciones).
  const estados = useMemo(() => {
    const set = new Set<string>(PORTAL_COTIZACION_ESTADOS_VISIBLES);
    cotizaciones.forEach((c) => set.add(c.estado));
    return Array.from(set);
  }, [cotizaciones]);

  const filtered = useMemo(() => {
    return cotizaciones.filter((c) => {
      if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.folio.toLowerCase().includes(q) ||
          (c.origen || "").toLowerCase().includes(q) ||
          (c.destino || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cotizaciones, search, filtroEstado]);

  if (isLoading || isError) {
    // R-05: la carga nunca se queda colgada; a los 15s (o ante error) se
    // ofrece "Reintentar" en vez de un skeleton perpetuo.
    // UI-4: el encabezado se conserva para no perder el contexto de la página.
    return (
      <PortalPageShell icon={<ClipboardList className="h-6 w-6 text-accent" />} title="Mis cotizaciones">
        <LoadingState
          error={isError}
          onRetry={() => void refetch()}
          errorLabel="No pudimos cargar tus cotizaciones."
        />
      </PortalPageShell>
    );
  }


  return (
    <PortalPageShell
      icon={<ClipboardList className="h-6 w-6 text-accent" />}
      title="Mis cotizaciones"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-body text-muted-foreground tabular-nums">{filtered.length} de {cotizaciones.length}</span>
          <Button size="sm" onClick={() => setSolicitudAbierta(true)}>
            <Plus className="h-4 w-4 mr-1" aria-hidden /> Solicitar cotización
          </Button>
        </div>
      }
    >
      <SolicitarCotizacionDialog
        open={solicitudAbierta}
        onOpenChange={setSolicitudAbierta}
        clientes={clientes}
      />

      <PortalFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por folio, ruta…"
        selects={[
          {
            value: filtroEstado,
            onChange: setFiltroEstado,
            options: estados,
            placeholder: "Estado",
            allLabel: "Todos los estados",
          },
        ]}
      />

      <PortalCotizacionesMobileFilters
        search={search}
        onSearchChange={setSearch}
        estados={estados}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search || filtroEstado !== "todos" ? "No se encontraron cotizaciones" : "Aún no tienes cotizaciones"}
          description={search || filtroEstado !== "todos"
            ? "Ajusta los filtros o busca con otro término."
            : "Solicita tu primera cotización y nuestro equipo te enviará una propuesta."}
          primaryAction={search || filtroEstado !== "todos" ? {
            label: "Limpiar filtros",
            variant: "outline",
            onClick: () => { setSearch(""); setFiltroEstado("todos"); },
          } : {
            label: "Solicitar cotización",
            onClick: () => setSolicitudAbierta(true),
          }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <PortalCotizacionCard
              key={c.id}
              cotizacion={c as PortalCotizacionCardRow}
              tasaIva={tasaIva}
            />
          ))}
        </div>
      )}
    </PortalPageShell>
  );
}
