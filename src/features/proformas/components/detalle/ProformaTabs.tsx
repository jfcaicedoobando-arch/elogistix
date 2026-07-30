/**
 * Pestañas del detalle de proforma, en espejo con facturas emitidas y
 * recibidas: Conceptos · Cliente y datos generales · Facturación.
 */
import { DocumentoTabs, type DocumentoTabItem } from "@/components/shared/documento/DocumentoTabs";
import { ProformaConceptosCard } from "@/features/proformas/components/detalle/ProformaConceptosCard";
import { ProformaDatosGeneralesCard } from "@/features/proformas/components/detalle/ProformaDatosGeneralesCard";
import { ClienteBillToCard } from "@/features/proformas/components/detalle/ClienteBillToCard";
import { EmbarqueDatosCard } from "@/features/proformas/components/detalle/EmbarqueDatosCard";
import {
  FacturaAsociadaCard,
  NotasCard,
} from "@/features/proformas/components/ProformaDetalleCards";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { ProformaDetalleFull, ConceptoVentaRow } from "@/features/proformas/services";

type Totales = ReturnType<typeof calcularTotalesProforma>;

interface Props {
  proforma: ProformaDetalleFull;
  conceptos: ConceptoVentaRow[];
  totales: Totales;
  emptyConceptos: string;
}

export function ProformaTabs({ proforma, conceptos, totales, emptyConceptos }: Props) {
  const facturas = proforma.facturas_asociadas ?? [];
  const clienteFull = proforma.cliente_full ?? null;
  const embarqueFull = proforma.embarque_full ?? null;
  const mostrarEmbarque = !!embarqueFull && !proforma.es_consolidada;

  const tabs: DocumentoTabItem[] = [
    {
      id: "conceptos",
      label: "Conceptos",
      count: conceptos.length,
      content: (
        <ProformaConceptosCard
          conceptos={conceptos}
          totales={totales}
          emptyMessage={emptyConceptos}
        />
      ),
    },
    {
      id: "fiscal",
      label: "Cliente y datos generales",
      content: (
        <>
          <ProformaDatosGeneralesCard
            fechaEmision={proforma.fecha_emision}
            diasCredito={proforma.dias_credito}
            diasCreditoCliente={clienteFull?.dias_credito}
            folioFacturaExterna={proforma.folio_factura_externa}
            blMaster={proforma.bl_master}
          />
          <ClienteBillToCard
            cliente={clienteFull}
            clienteNombreFallback={proforma.cliente_nombre}
            clienteId={proforma.cliente_id}
          />
          {mostrarEmbarque && (
            <EmbarqueDatosCard
              embarque={embarqueFull}
              embarqueId={proforma.embarque_id}
              expediente={proforma.expediente}
            />
          )}
          <NotasCard notas={proforma.notas} />
        </>
      ),
    },
    {
      id: "facturacion",
      label: "Facturación",
      count: facturas.length,
      content:
        facturas.length > 0 ? (
          <FacturaAsociadaCard facturas={facturas} />
        ) : (
          <p className="rounded-md border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            Esta proforma aún no tiene facturas asociadas.
          </p>
        ),
    },
  ];

  return <DocumentoTabs tabs={tabs} />;
}
