/**
 * Bandeja de Pricing: solicitudes enviadas desde el CRM, ordenadas por
 * vencimiento. Vive como pestaña dentro de `/costeo/tarifas?tab=bandeja`
 * (el aviso de la campanita llega con `?id=` y la ruta legacy redirige aquí).
 */
import { useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import PaginationControls from "@/components/shared/PaginationControls";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBandejaPricing, useSolicitudPricing } from "@/features/crm/hooks/usePricingCrm";
import { PAGINA_PRICING } from "@/features/crm/services/pricing/pricingCrm";
import { ETIQUETA_ESTADO_PRICING } from "@/features/crm/services/pricing/tiposPricing";
import { RelojPricing } from "@/features/crm/components/pricing/RelojPricing";
import { SolicitudPricingDetalle } from "@/features/crm/components/pricing/SolicitudPricingDetalle";

const ESTADOS = [
  { value: "enviada", label: "Por responder" }, { value: "respondida", label: "Respondidas" },
  { value: "cancelada", label: "Canceladas" }, { value: "todos", label: "Todas" },
];

export function BandejaPricingPanel() {
  const [params, setParams] = useSearchParams();
  const estado = params.get("estado") ?? "enviada";
  const pagina = Number(params.get("p") ?? "0") || 0;
  const id = params.get("id");
  const { data, isLoading, error, refetch } = useBandejaPricing(estado, pagina);
  const detalle = useSolicitudPricing(id);
  const cambiar = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v == null) n.delete(k); else n.set(k, v);
    if (k === "estado") n.delete("p");
    setParams(n, { replace: true });
  };
  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / PAGINA_PRICING));

  return (
    <>
      <PageHeader title="Bandeja de pricing" description="Baja 8 h · Media 24 h · Alta 48 h para responder." />
        <Select value={estado} onValueChange={(v) => cambiar("estado", v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
        </Select>
      {error && <ErrorStateInline message="No se pudieron cargar las solicitudes." onRetry={() => void refetch()} />}
      {isLoading && <EmptyStateInline loading message="Cargando solicitudes…" />}
      {!isLoading && !error && total === 0 && <EmptyStateInline message="No hay solicitudes." />}
      <div className="space-y-2">
        {(data?.filas ?? []).map((s) => (
          <button key={s.id} type="button" onClick={() => cambiar("id", id === s.id ? null : s.id)}
            className="flex w-full flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-left hover:bg-muted/50">
            <span className="font-medium">{s.folio}</span>
            <Badge variant="outline">{ETIQUETA_ESTADO_PRICING[s.estado] ?? s.estado}</Badge>
            <span className="text-body-sm">{s.cliente ?? "Sin cliente"}</span>
            <span className="text-body-sm text-muted-foreground">{[s.servicio, s.origen ?? s.pol, s.destino ?? s.pod].filter(Boolean).join(" · ")}</span>
            <span className="ml-auto"><RelojPricing enviadaAt={s.enviada_at} venceAt={s.vence_at} respondidaAt={s.respondida_at} /></span>
          </button>
        ))}
      </div>
      {!isLoading && !error && <PaginationControls page={pagina} totalPages={paginas} total={total} pageSize={PAGINA_PRICING}
        onPageChange={(p) => cambiar("p", String(p))} />}
      {detalle.data && <SolicitudPricingDetalle solicitud={detalle.data} />}
    </>
  );
}
