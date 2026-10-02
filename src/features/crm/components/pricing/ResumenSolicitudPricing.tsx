/**
 * Datos capturados por el solicitante, sólo lectura.
 */
import { Card, CardContent } from "@/components/ui/card";
import { formatFechaDia } from "@/lib/formatters/dates";
import { useUsuariosOrgCrm } from "@/features/crm/hooks/usePricingCrm";
import { ETIQUETA_COMPLEJIDAD, type ComplejidadPricing, type SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";

const siNo = (v: boolean | null) => (v == null ? null : v ? "Sí" : "No");

export function ResumenSolicitudPricing({ solicitud: s }: { solicitud: SolicitudPricingRow }) {
  const { data: usuarios = [] } = useUsuariosOrgCrm();
  const solicitante = usuarios.find((u) => u.user_id === s.solicitante_id)?.nombre ?? null;
  const campos: Array<[string, string | number | null]> = [
    ["Solicitante", solicitante], ["Fecha", formatFechaDia(s.fecha)], ["Cliente", s.cliente],
    ["Service", s.servicio], ["Complejidad", ETIQUETA_COMPLEJIDAD[s.complejidad as ComplejidadPricing] ?? s.complejidad],
    ["Incoterm", s.incoterm], ["IMO", siNo(s.imo)], ["Commodity", s.commodity],
    ["Container Size", s.container_size], ["Type", s.tipo_carga], ["Quantity", s.cantidad],
    ["Estibable", siNo(s.estibable)], ["Weight", s.peso], ["Dimensions", s.dimensiones],
    ["AOL/POL", s.pol], ["AOD/POD", s.pod], ["Origen", s.origen], ["Destino", s.destino],
    ["Fecha tentativa de carga", formatFechaDia(s.fecha_tentativa_carga)], ["Delivery", s.delivery],
  ];
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 py-4 md:grid-cols-4">
        {campos.map(([l, v]) => (
          <div key={l}>
            <p className="text-caption text-muted-foreground">{l}</p>
            <p className="text-body-sm">{v ?? "—"}</p>
          </div>
        ))}
        {s.notas && (
          <div className="col-span-full">
            <p className="text-caption text-muted-foreground">Notas importantes</p>
            <p className="whitespace-pre-wrap text-body-sm">{s.notas}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
