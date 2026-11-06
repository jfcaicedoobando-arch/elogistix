import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFechaHoraCorta, formatNumber, nombreDesdeEmail } from "@/lib/formatters";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { fetchHandover, fetchHandoverProveedores } from "@/features/cotizacion/services/handover";
import { puedeVerHandover } from "@/features/cotizacion/domain/handoverVisibilidad";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolveTipoContenedorNombre } from "@/lib/domain/tipoContenedor";

export function CotizacionHandover({ cotizacion }: { cotizacion: CotizacionRow }) {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const visible = puedeVerHandover(effectiveRole, organizationId, cotizacion.organization_id);
  const query = useQuery({
    queryKey: cotizaciones.handover(cotizacion.id, organizationId, cotizacion.updated_at),
    enabled: visible,
    queryFn: () => organizationId ? fetchHandover(cotizacion.id, organizationId) : Promise.resolve(null),
  });

  const proveedores = useQuery({
    queryKey: cotizaciones.handoverProveedores(cotizacion.agente_id ?? null, cotizacion.naviera_id ?? null),
    enabled: visible && Boolean(query.data),
    queryFn: () => fetchHandoverProveedores(cotizacion.agente_id, cotizacion.naviera_id),
  });

  if (!visible) return null;
  if (query.isLoading) return <Skeleton className="h-24 w-full" />;
  if (query.isError) return (
    <section className="border-y py-4 space-y-3" aria-label="Ficha de handover">
      <SectionHeading>Ficha de handover</SectionHeading>
      <p role="alert" className="text-body-sm text-destructive">No pudimos cargar el handover.</p>
      <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Reintentar</Button>
    </section>
  );
  if (!query.data) return null;

  const fields = handoverFields(cotizacion, query.data.created_at, tiposContenedor, proveedores.data);

  return (
    <section className="border-y py-4 space-y-4" aria-label="Ficha de handover">
      <SectionHeading icon={<ArrowRightLeft className="size-4" />}>Ficha de handover</SectionHeading>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-body">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type TiposContenedor = ReturnType<typeof useTiposContenedor>["data"];
function handoverFields(
  cotizacion: CotizacionRow, createdAt: string,
  tiposContenedor: NonNullable<TiposContenedor>, prov: { agente: string | null; naviera: string | null } | undefined,
): Array<[string, string]> {
  return [
    ["Cliente", cotizacion.cliente_nombre || cotizacion.prospecto_empresa || "—"],
    ["Comercial", cotizacion.vendedor_email ? nombreDesdeEmail(cotizacion.vendedor_email) : "Sin asignar"],
    ["Fecha del handover", formatFechaHoraCorta(createdAt)],
    ["Modo / Incoterm", `${cotizacion.modo} / ${cotizacion.incoterm}`],
    ["Origen", cotizacion.origen || "—"],
    ["Destino", cotizacion.destino || "—"],
    ["Mercancía", cotizacion.descripcion_mercancia || "—"],
    ["Contenedor", resolveTipoContenedorNombre(cotizacion.tipo_contenedor, tiposContenedor, "—")],
    ["Número de contenedores", cotizacion.num_contenedores == null ? "—" : formatNumber(cotizacion.num_contenedores)],
    ["Peso", cotizacion.peso_kg == null ? "—" : `${formatNumber(cotizacion.peso_kg)} kg`],
    ["Volumen", cotizacion.volumen_m3 == null ? "—" : `${formatNumber(cotizacion.volumen_m3)} m³`],
    ["Agente en origen", prov?.agente ?? "—"],
    ["Naviera", prov?.naviera ?? "—"],
    ["Seguro", cotizacion.seguro ? "Sí" : "No"],
  ];
}
