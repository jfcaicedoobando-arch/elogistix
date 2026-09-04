/**
 * Vista CRM dentro de ClienteDetalle (Sprint D): oportunidades, última
 * cotización, último embarque y timeline de actividades.
 */
import { useNavigate } from "react-router-dom";
import { Briefcase, ClipboardList, FileText, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { useCliente360 } from "@/features/crm/hooks";
import type { Cliente360Oportunidad } from "@/features/crm/services/cliente360";
import { formatCurrencyCompact } from "@/lib/formatters";
import ActividadTimeline from "@/features/crm/components/ActividadTimeline";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  clienteId: string;
}

const LIMITE_VISIBLE = 10;

export default function Cliente360Panel({ clienteId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useCliente360(clienteId);

  if (isLoading) return <EmptyStateInline loading message="Cargando datos CRM…" />;

  const d = data ?? { oportunidades: [], totales: [], ultimaCotizacion: null, ultimoEmbarque: null };

  const columns: ColumnDef<Cliente360Oportunidad, unknown>[] = defineColumns<Cliente360Oportunidad>([
    { id: "nombre", header: "Nombre", meta: { width: COL_W.texto, className: "font-medium" }, cell: ({ row }) => row.original.nombre },
    {
      id: "monto", header: "Monto", meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => formatCurrencyCompact(Number(row.original.valor_real ?? row.original.monto_estimado ?? 0), row.original.moneda),
    },
    {
      id: "probabilidad", header: "Prob.", meta: { width: COL_W.tiny, align: "right" },
      cell: ({ row }) => `${row.original.probabilidad}%`,
    },
    {
      id: "vendedor", header: "Vendedor", meta: { width: COL_W.nombre, className: "text-muted-foreground" },
      cell: ({ row }) => row.original.vendedor_email || "—",
    },
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {d.totales.length === 0 ? (
          <>
            <KpiCard label="Pipeline abierto" value={formatCurrencyCompact(0, "MXN")} />
            <KpiCard label="Negocio ganado" value={formatCurrencyCompact(0, "MXN")} />
          </>
        ) : (
          d.totales.map((t) => (
            <div key={t.moneda} className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
              <KpiCard label={`Pipeline abierto (${t.moneda})`} value={formatCurrencyCompact(t.totalAbierto, t.moneda)} />
              <KpiCard label={`Negocio ganado (${t.moneda})`} value={formatCurrencyCompact(t.totalGanado, t.moneda)} />
            </div>
          ))
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Oportunidades ({d.oportunidades.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-2">
          {d.oportunidades.length === 0 ? (
            <EmptyStateInline icon={Briefcase} message="Sin oportunidades registradas." />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={d.oportunidades.slice(0, LIMITE_VISIBLE)}
                rowKey={(o) => o.id}
                density={TABLE_DENSITY.embebida}
                getRowHref={(o) => `/crm/oportunidades/${o.id}`}
                getRowAriaLabel={(o) => `Abrir oportunidad ${o.nombre}`}
              />
              {d.oportunidades.length > LIMITE_VISIBLE && (
                <div className="flex items-center justify-between px-4 pb-2">
                  <span className="text-label text-muted-foreground">
                    +{d.oportunidades.length - LIMITE_VISIBLE} más
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/crm/oportunidades?clienteId=${clienteId}`)}>
                    Ver todas
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Última cotización</CardTitle>
          </CardHeader>
          <CardContent>
            {d.ultimaCotizacion ? (
              <div className="space-y-1 text-body-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{d.ultimaCotizacion.folio}</span>
                  <Badge variant="outline">{d.ultimaCotizacion.estado}</Badge>
                </div>
                <div className="text-muted-foreground">{formatCurrencyCompact(Number(d.ultimaCotizacion.subtotal ?? 0), d.ultimaCotizacion.moneda || "MXN")}</div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/cotizaciones/${d.ultimaCotizacion!.id}`)}>Ver cotización</Button>
              </div>
            ) : <EmptyStateInline icon={FileText} message="Sin cotizaciones." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Ship className="h-4 w-4" /> Último embarque</CardTitle>
          </CardHeader>
          <CardContent>
            {d.ultimoEmbarque ? (
              <div className="space-y-1 text-body-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{d.ultimoEmbarque.expediente}</span>
                  <Badge variant="outline">{d.ultimoEmbarque.estado}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/embarques/${d.ultimoEmbarque!.id}`)}>Ver embarque</Button>
              </div>
            ) : <EmptyStateInline icon={Ship} message="Sin embarques." />}
          </CardContent>
        </Card>
      </div>

      <ActividadTimeline entidadTipo="cliente" entidadId={clienteId} />
    </div>
  );
}
