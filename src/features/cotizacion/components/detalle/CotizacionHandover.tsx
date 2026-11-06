import { useHandoverProveedores } from "@/features/cotizacion/hooks/useHandoverProveedores";
import { useCotizacionHandover } from "@/features/cotizacion/hooks/useCotizacionHandover";
import { ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { CoordinadorSelect } from "@/components/shared/CoordinadorSelect";
import { puedeAsignarCoordinador } from "@/lib/access/coordinadorAsignacion";
import { reasignarCoordinadorHandover } from "@/lib/operaciones/coordinador";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFechaHoraCorta, formatNumber, nombreDesdeEmail } from "@/lib/formatters";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolveTipoContenedorNombre } from "@/lib/domain/tipoContenedor";

export function CotizacionHandover({ cotizacion }: { cotizacion: CotizacionRow }) {
  const { visible, query } = useCotizacionHandover(cotizacion);
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const { effectiveRole } = useAuth();

  const proveedores = useHandoverProveedores(cotizacion, visible && Boolean(query.data));

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
      {proveedores.isError && (
        <div className="space-y-2">
          <p role="alert" className="text-body-sm text-destructive">No pudimos cargar el agente y la naviera.</p>
          <Button variant="outline" size="sm" onClick={() => void proveedores.refetch()}>Reintentar proveedores</Button>
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-body">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
        <CoordinadorSelect
          label="Coordinador logístico"
          value={query.data.coordinador_id}
          editable={puedeAsignarCoordinador(effectiveRole)}
          onGuardar={(id) => id ? reasignarCoordinadorHandover(cotizacion.id, id) : Promise.resolve()}
          onGuardado={() => void query.refetch()}
        />
      </dl>
    </section>
  );
}

type TiposContenedor = ReturnType<typeof useTiposContenedor>["data"];
function handoverFields(
  cotizacion: CotizacionRow, createdAt: string,
  tiposContenedor: NonNullable<TiposContenedor>, prov: { agente: string | null; naviera: string | null } | null | undefined,
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
