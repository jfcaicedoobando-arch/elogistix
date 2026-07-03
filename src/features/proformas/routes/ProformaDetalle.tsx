/**
 * ProformaDetalle — página dedicada de una proforma individual.
 * Drilldown desde el tab Facturación del embarque y del módulo Facturación.
 */
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatDate, nombreDesdeEmail } from "@/lib/formatters";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useProformaDetalle } from "@/features/proformas/hooks/useProformaDetalle";
import { useDescargarProformaPdf } from "@/features/embarques/hooks/useDescargarProformaPdf";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import { vigenciaPlus30 } from "@/features/proformas/domain/proformaDetalleHelpers";
import {
  EstadoBadges,
  TotalDestacado,
  AccionesProforma,
  FacturaAsociadaCard,
  NotasCard,
  TotalesCard,
} from "@/features/proformas/components/ProformaDetalleCards";
import { ClienteBillToCard } from "@/features/proformas/components/detalle/ClienteBillToCard";
import { EmbarqueDatosCard } from "@/features/proformas/components/detalle/EmbarqueDatosCard";
import { TerminosPagoCard } from "@/features/proformas/components/detalle/TerminosPagoCard";
import { TimelineProforma } from "@/features/proformas/components/detalle/TimelineProforma";

import type { ConceptoVentaRow } from "@/features/proformas/services";

const conceptoColumns: ColumnDef<ConceptoVentaRow, unknown>[] = defineColumns<ConceptoVentaRow>([
  { id: "descripcion", header: "Descripción", cell: ({ row }) => row.original.descripcion },
  {
    id: "cantidad",
    header: "Cant.",
    meta: { align: "right", className: "w-[80px] tabular-nums" },
    cell: ({ row }) => Number(row.original.cantidad),
  },
  {
    id: "precio",
    header: "Precio unitario",
    meta: { align: "right", className: "w-[140px] tabular-nums" },
    cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda),
  },
  {
    id: "importe",
    header: "Importe",
    meta: { align: "right", className: "w-[140px] tabular-nums font-medium" },
    cell: ({ row }) => formatCurrency(
      Number(row.original.cantidad) * Number(row.original.precio_unitario),
      row.original.moneda,
    ),
  },
  {
    id: "iva",
    header: "IVA",
    meta: { align: "center", className: "w-[80px] text-xs" },
    cell: ({ row }) => row.original.aplica_iva || row.original.moneda === "MXN" ? "Sí" : "No",
  },
]);

function HeaderMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-sm truncate" : "text-sm truncate"} title={value}>{value}</p>
    </div>
  );
}

export default function ProformaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useProformaDetalle(id);
  const { descargar, downloadingId } = useDescargarProformaPdf();
  const tasaIva = useTasaIVA();
  useRegisterBreadcrumbLabel(id, data?.proforma.numero);

  const totales = useMemo(
    () => (data ? calcularTotalesProforma(data.conceptos, tasaIva) : null),
    [data, tasaIva],
  );

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Cargando proforma…" />
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <ErrorState
          title="Proforma no encontrada"
          description="La proforma no existe o no tienes acceso."
          onRetry={() => navigate(-1)}
          retryLabel="Volver"
        />
      </PageContainer>
    );
  }

  const { proforma, conceptos } = data;

  // SAFE-CAST: columnas nuevas; tipos generados aún no las incluyen.
  const rawProforma = proforma as unknown as { estado_cliente?: string; aceptada_por?: string | null };
  const rawEstadoCliente = rawProforma.estado_cliente;
  const estadoCliente: "pendiente" | "aceptada" | "rechazada" =
    rawEstadoCliente === "aceptada" || rawEstadoCliente === "rechazada"
      ? rawEstadoCliente
      : "pendiente";
  const aceptadaPor = rawProforma.aceptada_por ?? null;
  const factura = proforma.facturas_full;
  const clienteFull = proforma.cliente_full ?? null;
  const embarqueFull = proforma.embarque_full ?? null;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-mono tabular-nums">{proforma.numero}</h1>
                <EstadoBadges
                  estadoProforma={proforma.estado_proforma}
                  estadoCliente={estadoCliente}
                  aceptadaPor={aceptadaPor}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate" title={proforma.cliente_nombre ?? ""}>
                {proforma.cliente_nombre} • Exp: <span className="font-mono">{proforma.expediente}</span>
              </p>
            </div>
            {totales && <TotalDestacado totales={totales} />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
            <HeaderMeta label="Fecha emisión" value={formatDate(proforma.fecha_emision)} />
            <HeaderMeta label="Vigencia" value={vigenciaPlus30(proforma.fecha_emision)} />
            <HeaderMeta
              label="BL Master / MAWB"
              value={proforma.bl_master?.trim() || "—"}
              mono
            />
            <HeaderMeta
              label="BL House / HAWB"
              value={embarqueFull?.bl_house?.trim() || "—"}
              mono
            />
            <HeaderMeta
              label="Ejecutivo"
              value={proforma.operador ? nombreDesdeEmail(proforma.operador) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      <AccionesProforma
        proforma={proforma}
        downloadingId={downloadingId}
        onDescargar={() => descargar(proforma)}
      />

      {/* Cliente + Embarque en rejilla de 2 columnas */}
      <div className={`grid gap-4 ${embarqueFull && !proforma.es_consolidada ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        <ClienteBillToCard cliente={clienteFull} clienteNombreFallback={proforma.cliente_nombre} />
        {embarqueFull && !proforma.es_consolidada && <EmbarqueDatosCard embarque={embarqueFull} />}
      </div>

      <TerminosPagoCard
        fechaEmision={proforma.fecha_emision}
        diasCredito={proforma.dias_credito}
        folioFacturaExterna={proforma.folio_factura_externa}
      />

      <TimelineProforma proforma={proforma} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={conceptoColumns}
            data={conceptos}
            rowKey={(c) => c.id}
            density="compact"
            emptyMessage={proforma.es_consolidada ? "Proforma consolidada (ver detalle agregado en el PDF)." : "Sin conceptos."}
          />
        </CardContent>
      </Card>

      {totales && <TotalesCard totales={totales} />}
      <NotasCard notas={proforma.notas} />
      {factura && <FacturaAsociadaCard factura={factura} />}
    </div>
  );
}
