/**
 * Vista CRM dentro de ClienteDetalle (Sprint D): oportunidades, última
 * cotización, último embarque y timeline de actividades.
 */
import { useNavigate } from "react-router-dom";
import { Briefcase, ClipboardList, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCliente360 } from "@/features/crm/hooks";
import { formatCurrencyCompact } from "@/lib/formatters";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  clienteId: string;
}

export default function Cliente360Panel({ clienteId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useCliente360(clienteId);

  const d = data ?? { oportunidades: [], totalAbierto: 0, totalGanado: 0, ultimaCotizacion: null, ultimoEmbarque: null };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline abierto</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrencyCompact(d.totalAbierto, "MXN")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Negocio ganado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrencyCompact(d.totalGanado, "MXN")}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Oportunidades ({d.oportunidades.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {d.oportunidades.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Sin oportunidades registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 px-3">Nombre</th>
                  <th className="text-right">Monto</th>
                  <th className="text-right">Prob.</th>
                  <th className="text-left">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {d.oportunidades.slice(0, 10).map((o) => (
                  <tr
                    key={o.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/crm/oportunidades/${o.id}`)}
                  >
                    <td className="py-2 px-3 font-medium">{o.nombre}</td>
                    <td className="text-right">{formatCurrencyCompact(Number(o.valor_real ?? o.monto_estimado ?? 0), o.moneda)}</td>
                    <td className="text-right">{o.probabilidad}%</td>
                    <td className="text-xs text-muted-foreground">{o.vendedor_email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Última cotización</CardTitle>
          </CardHeader>
          <CardContent>
            {d.ultimaCotizacion ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{d.ultimaCotizacion.folio}</span>
                  <Badge variant="outline">{d.ultimaCotizacion.estado}</Badge>
                </div>
                <div className="text-muted-foreground">{formatCurrencyCompact(Number(d.ultimaCotizacion.subtotal ?? 0), "MXN")}</div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/cotizaciones/${d.ultimaCotizacion!.id}`)}>Ver cotización</Button>
              </div>
            ) : <p className="text-sm text-muted-foreground">Sin cotizaciones.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Ship className="h-4 w-4" /> Último embarque</CardTitle>
          </CardHeader>
          <CardContent>
            {d.ultimoEmbarque ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{d.ultimoEmbarque.expediente}</span>
                  <Badge variant="outline">{d.ultimoEmbarque.estado}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/embarques/${d.ultimoEmbarque!.id}`)}>Ver embarque</Button>
              </div>
            ) : <p className="text-sm text-muted-foreground">Sin embarques.</p>}
          </CardContent>
        </Card>
      </div>

      <ActividadTimeline entidadTipo="cliente" entidadId={clienteId} />
    </div>
  );
}
